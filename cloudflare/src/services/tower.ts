import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { User } from '../types';
import { getUser, saveUser, drawTokenExists, insertDrawToken } from '../db';
import { createRng } from '../roll-engine';
import { bumpQuestProgress, todayCN } from './quests';
import { getActiveEvent, towerBoost } from './events';
import { TOWER, enemyPower, guardianOf, isMilestone } from '../tower-config';

// 试炼塔：爬层制单人 PVE，进阶石主产出点（trial-tower-spec）。
// 服务端全链路权威：次数扣减 / 敌力计算 / 随机数 / 胜负判定 / 奖励发放。

export class TowerError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface TowerState {
  bestFloor: number;
  challengesUsed: number;
  challengesLeft: number;
  sweepAvailable: boolean;
}

interface TowerRow {
  openid: string;
  best_floor: number;
  challenge_date: string | null;
  challenges_used: number;
  sweep_date: string | null;
  updated_at: number;
}

async function getTowerRow(db: D1Database, openid: string): Promise<TowerRow> {
  const row = await db
    .prepare('SELECT * FROM tower_state WHERE openid = ?')
    .bind(openid)
    .first<TowerRow>();
  if (row) return row;
  return {
    openid,
    best_floor: 0,
    challenge_date: null,
    challenges_used: 0,
    sweep_date: null,
    updated_at: 0,
  };
}

function toState(row: TowerRow, dailyChallenges: number): TowerState {
  const today = todayCN();
  const used = row.challenge_date === today ? row.challenges_used : 0;
  return {
    bestFloor: row.best_floor,
    challengesUsed: used,
    challengesLeft: Math.max(0, dailyChallenges - used),
    sweepAvailable: row.best_floor > 0 && row.sweep_date !== today,
  };
}

// tower_boost 活动生效时的每日挑战次数（extraChallenges clamp [0,5]）
async function effectiveDailyChallenges(db: D1Database, kv?: KVNamespace): Promise<number> {
  const boost = towerBoost(await getActiveEvent(db, 'tower_boost', kv));
  return TOWER.dailyChallenges + boost.extraChallenges;
}

export async function getTowerInfo(db: D1Database, openid: string, kv?: KVNamespace) {
  const row = await getTowerRow(db, openid);
  const dailyChallenges = await effectiveDailyChallenges(db, kv);
  const state = toState(row, dailyChallenges);
  const nextFloor = row.best_floor + 1;
  return {
    state,
    nextFloor:
      nextFloor <= TOWER.floorMax
        ? { floor: nextFloor, enemy: guardianOf(nextFloor) }
        : null,
    config: {
      floorMax: TOWER.floorMax,
      dailyChallenges,
      milestoneEvery: TOWER.milestoneEvery,
    },
  };
}

function grantRewards(user: User, rewards: Record<string, number>) {
  for (const [key, amount] of Object.entries(rewards)) {
    user.wallet[key] = (user.wallet[key] ?? 0) + amount;
  }
}

async function upsertTowerRow(db: D1Database, row: TowerRow) {
  await db
    .prepare(
      `INSERT INTO tower_state (openid, best_floor, challenge_date, challenges_used, sweep_date, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(openid) DO UPDATE SET
         best_floor=?, challenge_date=?, challenges_used=?, sweep_date=?, updated_at=?`,
    )
    .bind(
      row.openid, row.best_floor, row.challenge_date, row.challenges_used, row.sweep_date, row.updated_at,
      row.best_floor, row.challenge_date, row.challenges_used, row.sweep_date, row.updated_at,
    )
    .run();
}

// POST /api/tower/challenge —— 挑战下一层。clientToken 幂等防弱网双扣次数。
export async function challengeTower(
  db: D1Database,
  openid: string,
  clientToken?: string,
  kv?: KVNamespace,
) {
  if (clientToken && (await drawTokenExists(db, clientToken))) {
    throw new TowerError(409, 'Duplicate clientToken');
  }

  const user = await getUser(db, openid);
  if (!user) throw new TowerError(401, 'User not initialized');

  // tower_boost 活动：次数上限与首通奖励加成（一次性读定，本请求内口径一致）
  const boost = towerBoost(await getActiveEvent(db, 'tower_boost', kv));
  const dailyChallenges = TOWER.dailyChallenges + boost.extraChallenges;

  const row = await getTowerRow(db, openid);
  const today = todayCN();
  // 切日重置次数（trial-tower-spec §5.2）
  if (row.challenge_date !== today) {
    row.challenge_date = today;
    row.challenges_used = 0;
  }
  if (row.best_floor >= TOWER.floorMax) throw new TowerError(400, '已通关全部层数');
  if (row.challenges_used >= dailyChallenges) throw new TowerError(400, '今日挑战次数已用完');

  const floor = row.best_floor + 1;
  const enemy = guardianOf(floor);

  // 结算：与 PK 同一套方差模型（trial-tower-spec §1.3 方案 A）
  const rand = createRng();
  const myVal = user.power * (0.85 + 0.3 * rand());
  const win = myVal >= enemy.power;

  // 扣次数（无论成败——防无限重 roll 随机数）
  row.challenges_used += 1;
  row.updated_at = Date.now();

  const rewards: Record<string, number> = {};
  if (win) {
    row.best_floor = floor;
    // tower_boost 首通加成只乘 fragments/dust 基础包，里程碑 stone 不乘（防进阶石供给失控）
    const mult = 1 + boost.firstClearBonus;
    rewards.fragments = TOWER.rewards.firstClear.fragments * mult;
    rewards.dust = TOWER.rewards.firstClear.dust * mult;
    if (isMilestone(floor)) {
      for (const [k, v] of Object.entries(TOWER.rewards.milestone)) {
        rewards[k] = (rewards[k] ?? 0) + v;
      }
    }
  } else {
    Object.assign(rewards, TOWER.rewards.consolation);
  }
  grantRewards(user, rewards);
  user.updated_at = Date.now();

  await saveUser(db, user);
  await upsertTowerRow(db, row);
  if (clientToken) await insertDrawToken(db, clientToken, openid);

  // 任务埋点：挑战计数（d_tower1）；首通新层计数（w_tower15）
  await bumpQuestProgress(db, openid, 'tower_challenge', 1);
  if (win) await bumpQuestProgress(db, openid, 'tower_clear', 1);

  return {
    win,
    floor,
    myVal: Math.round(myVal),
    enemyPower: enemy.power,
    enemyName: enemy.name,
    milestone: win && isMilestone(floor),
    rewards,
    wallet: user.wallet,
    state: toState(row, dailyChallenges),
  };
}

// POST /api/tower/sweep —— 每日免费扫荡已通最高层 1 次，固定成功，无 stone。
export async function sweepTower(db: D1Database, openid: string, kv?: KVNamespace) {
  const user = await getUser(db, openid);
  if (!user) throw new TowerError(401, 'User not initialized');

  const dailyChallenges = await effectiveDailyChallenges(db, kv);
  const row = await getTowerRow(db, openid);
  const today = todayCN();
  if (row.best_floor <= 0) throw new TowerError(400, '尚未通关任何层');
  if (row.sweep_date === today) throw new TowerError(400, '今日已扫荡');

  row.sweep_date = today;
  row.updated_at = Date.now();

  const rewards = { ...TOWER.rewards.sweep };
  grantRewards(user, rewards);
  user.updated_at = Date.now();

  await saveUser(db, user);
  await upsertTowerRow(db, row);

  return {
    floor: row.best_floor,
    rewards,
    wallet: user.wallet,
    state: toState(row, dailyChallenges),
  };
}
