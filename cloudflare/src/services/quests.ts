import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { User } from '../types';
import { getUser, saveUser } from '../db';
import {
  ALL_COUNTED_QUESTS,
  ACHIEVEMENTS,
  DAILY_BOX,
  DAILY_QUESTS,
  WEEKLY_QUESTS,
  type QuestDef,
} from '../quests-config';
import { getActiveEvent, type GameEvent } from './events';

// ===== 周期 key（UTC+8 口径，与 daily.ts 的 todayCN() 一致） =====

export function todayCN(): string {
  const shifted = new Date(Date.now() + 8 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function dailyPeriodKey(): string {
  return `D:${todayCN()}`;
}

// ISO 8601 周（周四定归属），按 UTC+8 平移后取 UTC 分量。
export function weeklyPeriodKey(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const day = d.getUTCDay() || 7; // 周一=1 … 周日=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // 本周周四
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `W:${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function periodKeyOf(quest: QuestDef): string {
  if (quest.type === 'daily') return dailyPeriodKey();
  if (quest.type === 'weekly') return weeklyPeriodKey();
  if (quest.type === 'event') return `E:${quest.eventId || 'unknown'}`; // festival_quest 活动任务
  return 'A'; // 成就一次性
}

// ===== festival_quest 活动任务（events-spec §3：复用 quest_progress，period_key='E:{eventId}'） =====

const VALID_EVENTS = new Set([
  'draw', 'upgrade', 'pk_attempt', 'pk_win', 'tower_challenge', 'tower_clear', 'exchange', 'server_pity',
]);

// 从活动 payload 解析任务定义（护栏：非法项丢弃——events-spec §7.3）
function parseEventQuests(ev: GameEvent): QuestDef[] {
  const raw = ev.payload?.quests;
  if (!Array.isArray(raw)) return [];
  const out: QuestDef[] = [];
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue;
    const questId = typeof q.questId === 'string' ? q.questId : '';
    const event = typeof q.event === 'string' ? q.event : '';
    const target = Number(q.target);
    const reward = q.reward;
    if (!questId || !VALID_EVENTS.has(event)) continue;
    if (!Number.isInteger(target) || target <= 0) continue;
    if (!reward || typeof reward !== 'object' || Array.isArray(reward)) continue;
    const cleanReward: Record<string, number> = {};
    for (const [k, v] of Object.entries(reward as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isInteger(n) && n > 0 && n <= 999) cleanReward[k] = n;
    }
    if (Object.keys(cleanReward).length === 0) continue;
    out.push({
      questId,
      type: 'event',
      eventId: ev.id,
      title: typeof q.title === 'string' ? q.title : questId,
      target,
      reward: cleanReward,
      sort: 1,
      event: event as QuestDef['event'],
    });
  }
  return out;
}

// 当前活动任务（无 festival_quest 活动时为空数组）
async function activeEventQuests(
  db: D1Database,
  kv?: KVNamespace,
): Promise<{ event: GameEvent; quests: QuestDef[] } | null> {
  const ev = await getActiveEvent(db, 'festival_quest', kv);
  if (!ev) return null;
  return { event: ev, quests: parseEventQuests(ev) };
}

// ===== 进度读写 =====

interface ProgressRow {
  progress: number;
  claimed: number;
}

async function getProgressRows(
  db: D1Database,
  openid: string,
  periodKeys: string[],
): Promise<Map<string, ProgressRow>> {
  const map = new Map<string, ProgressRow>();
  if (periodKeys.length === 0) return map;
  const placeholders = periodKeys.map(() => '?').join(',');
  const res = await db
    .prepare(
      `SELECT quest_id, period_key, progress, claimed FROM quest_progress WHERE openid = ? AND period_key IN (${placeholders})`,
    )
    .bind(openid, ...periodKeys)
    .all<{ quest_id: string; period_key: string; progress: number; claimed: number }>();
  for (const r of res.results) map.set(`${r.quest_id}|${r.period_key}`, r);
  return map;
}

// 计数型埋点：事件发生时由 draw/upgrade/pk/tower 等事务内调用。
// 只 bump 未达标任务（达标后不再增长，省写且表读数稳定）。
// festival_quest 活动任务一并匹配（直查 D1，不走 KV——埋点已在事务热点上，省一次 KV 往返）。
export async function bumpQuestProgress(
  db: D1Database,
  openid: string,
  event: string,
  amount: number,
  kv?: KVNamespace,
): Promise<void> {
  const evQuests = await activeEventQuests(db, kv);
  const matched = [
    ...ALL_COUNTED_QUESTS.filter((q) => q.event === event),
    ...(evQuests ? evQuests.quests.filter((q) => q.event === event) : []),
  ];
  if (matched.length === 0 || amount <= 0) return;

  const periodKeys = [...new Set(matched.map(periodKeyOf))];
  const rows = await getProgressRows(db, openid, periodKeys);

  const now = Date.now();
  const stmts = [];
  for (const q of matched) {
    const pk = periodKeyOf(q);
    const cur = rows.get(`${q.questId}|${pk}`);
    if (cur && (cur.claimed === 1 || cur.progress >= q.target)) continue;
    stmts.push(
      db
        .prepare(
          `INSERT INTO quest_progress (openid, quest_id, period_key, progress, claimed, updated_at)
           VALUES (?, ?, ?, ?, 0, ?)
           ON CONFLICT(openid, quest_id, period_key)
           DO UPDATE SET progress = progress + ?, updated_at = ?`,
        )
        .bind(openid, q.questId, pk, amount, now, amount, now),
    );
  }
  if (stmts.length) await db.batch(stmts);
}

// 状态型惰性重算：从 user 档案直接算进度（不读表、不写表）。
function statProgress(quest: QuestDef, user: User): number {
  const inv = user.inventory || {};
  const ids = Object.keys(inv).filter((id) => (inv[id]?.count || 0) > 0);
  switch (quest.stat) {
    case 'collect':
      return ids.filter((id) => id.startsWith(quest.world || '')).length;
    case 'star': {
      // 进度 = 该世界当前最高星级（toView 会按 target 截断显示）
      const stars = ids
        .filter((id) => id.startsWith(quest.world || ''))
        .map((id) => inv[id].star || 0);
      return stars.length ? Math.max(...stars) : 0;
    }
    case 'ur':
      return ids.filter((id) => id.startsWith(quest.world || '') && inv[id].rarity === 'UR').length;
    case 'total_draws':
      return user.total_draws || 0;
    case 'power':
      return user.power || 0;
    default:
      return 0;
  }
}

// ===== 对外读取：GET /api/quests 的完整状态 =====

export interface QuestView {
  questId: string;
  title: string;
  target: number;
  progress: number;
  claimed: boolean;
  canClaim: boolean;
  reward: Record<string, number>;
}

function toView(q: QuestDef, progress: number, claimed: boolean): QuestView {
  const p = Math.min(progress, q.target);
  return {
    questId: q.questId,
    title: q.title,
    target: q.target,
    progress: p,
    claimed,
    canClaim: !claimed && p >= q.target,
    reward: q.reward,
  };
}

export async function getQuestsState(db: D1Database, user: User, kv?: KVNamespace) {
  const evQuests = await activeEventQuests(db, kv);
  const periodKeys = [dailyPeriodKey(), weeklyPeriodKey(), 'A'];
  if (evQuests) periodKeys.push(`E:${evQuests.event.id}`);
  const rows = await getProgressRows(db, user.openid, periodKeys);
  const read = (q: QuestDef) => rows.get(`${q.questId}|${periodKeyOf(q)}`);

  const daily = DAILY_QUESTS.map((q) => toView(q, read(q)?.progress ?? 0, read(q)?.claimed === 1));
  const weekly = WEEKLY_QUESTS.map((q) => toView(q, read(q)?.progress ?? 0, read(q)?.claimed === 1));
  const achievements = ACHIEVEMENTS.map((q) =>
    toView(q, q.stat ? statProgress(q, user) : (read(q)?.progress ?? 0), read(q)?.claimed === 1),
  );
  const eventQuests = evQuests
    ? evQuests.quests.map((q) => toView(q, read(q)?.progress ?? 0, read(q)?.claimed === 1))
    : [];

  // 全勤宝箱：当日 4 条 daily 全部领取后开启
  const boxRow = read(DAILY_BOX);
  const dailyAllClaimed = daily.every((d) => d.claimed);
  const boxClaimed = boxRow?.claimed === 1;

  return {
    periodKey: { daily: dailyPeriodKey(), weekly: weeklyPeriodKey() },
    daily,
    weekly,
    achievements,
    event: evQuests
      ? { id: evQuests.event.id, title: evQuests.event.title, endAt: evQuests.event.endAt, quests: eventQuests }
      : null,
    dailyBox: {
      questId: DAILY_BOX.questId,
      title: DAILY_BOX.title,
      reward: DAILY_BOX.reward,
      claimed: boxClaimed,
      canClaim: !boxClaimed && dailyAllClaimed,
    },
  };
}

// ===== 领奖：POST /api/quests/claim =====

export class QuestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function grantReward(db: D1Database, user: User, reward: Record<string, number>) {
  for (const [key, amount] of Object.entries(reward)) {
    user.wallet[key] = (user.wallet[key] ?? 0) + amount;
  }
  user.updated_at = Date.now();
  await saveUser(db, user);
}

export async function claimQuest(
  db: D1Database,
  openid: string,
  questId: string,
  kv?: KVNamespace,
) {
  const user = await getUser(db, openid);
  if (!user) throw new QuestError(401, 'User not initialized');

  const now = Date.now();

  // 全勤宝箱
  if (questId === DAILY_BOX.questId) {
    const state = await getQuestsState(db, user, kv);
    if (state.dailyBox.claimed) {
      return { questId, claimed: true, alreadyClaimed: true, wallet: user.wallet };
    }
    if (!state.dailyBox.canClaim) throw new QuestError(400, '今日任务尚未全部领取');
    await db
      .prepare(
        `INSERT INTO quest_progress (openid, quest_id, period_key, progress, claimed, updated_at)
         VALUES (?, ?, ?, 1, 1, ?)
         ON CONFLICT(openid, quest_id, period_key) DO UPDATE SET claimed = 1, updated_at = ?`,
      )
      .bind(openid, DAILY_BOX.questId, dailyPeriodKey(), now, now)
      .run();
    await grantReward(db, user, DAILY_BOX.reward);
    return { questId, claimed: true, reward: DAILY_BOX.reward, wallet: user.wallet };
  }

  const evQuests = await activeEventQuests(db, kv);
  const quest = [...DAILY_QUESTS, ...WEEKLY_QUESTS, ...ACHIEVEMENTS, ...(evQuests?.quests ?? [])].find(
    (q) => q.questId === questId,
  );
  if (!quest) throw new QuestError(404, '任务不存在');
  const pk = periodKeyOf(quest);

  const row = await db
    .prepare('SELECT progress, claimed FROM quest_progress WHERE openid=? AND quest_id=? AND period_key=?')
    .bind(openid, questId, pk)
    .first<{ progress: number; claimed: number }>();

  if (row?.claimed === 1) {
    return { questId, claimed: true, alreadyClaimed: true, wallet: user.wallet };
  }

  // 进度：计数型读表，状态型惰性重算
  const progress = quest.stat ? statProgress(quest, user) : (row?.progress ?? 0);
  if (progress < quest.target) throw new QuestError(400, '任务未达成');

  await db
    .prepare(
      `INSERT INTO quest_progress (openid, quest_id, period_key, progress, claimed, updated_at)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(openid, quest_id, period_key) DO UPDATE SET claimed = 1, updated_at = ?`,
    )
    .bind(openid, questId, pk, progress, now, now)
    .run();
  await grantReward(db, user, quest.reward);
  return { questId, claimed: true, reward: quest.reward, wallet: user.wallet };
}
