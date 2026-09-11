import type { D1Database } from '@cloudflare/workers-types';
import type { User, Pity } from '../types';
import { getPool } from '../pools';
import { roll, createRng } from '../roll-engine';
import { computePower, dupFragmentGain } from '../power';
import {
  getUser,
  saveUser,
  insertHistoryBatch,
  getServerPity,
  setServerPity,
  drawTokenExists,
  insertDrawToken,
} from '../db';

// 掉落中的货币扇区：不入背包，直接加钱包余额。数值与客户端 drawLocal 对齐。
const CURRENCY_GAIN: Record<string, number> = {
  wish_stone: 1,
  chest_key: 1,
  machine_coin: 2,
  dust: 50,
};

export class DrawError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface DrawResultPayload {
  results: ReturnType<typeof roll>['results'];
  pityState: Pity;
  wallet: User['wallet'];
  power: number;
  serverPityTriggered: boolean;
}

// 抽卡事务编排（服务端权威）。handlers/draw.ts 只做参数解析与错误翻译。
export async function performDraw(
  db: D1Database,
  openid: string,
  poolId: string,
  times: number,
  clientToken?: string,
): Promise<DrawResultPayload> {
  const pool = getPool(poolId);
  if (!pool) throw new DrawError(404, 'Pool not found');

  // 幂等：同一 clientToken 拒绝重复提交（AC-04）。
  if (clientToken) {
    if (await drawTokenExists(db, clientToken)) {
      throw new DrawError(409, 'Duplicate clientToken');
    }
  }

  const user = await getUser(db, openid);
  if (!user) throw new DrawError(401, 'User not initialized');

  // 货币检查：不足则不扣减、不写历史（AC-03）。
  const costItem = pool.cost.itemId;
  const unit = pool.cost.amount;
  const totalCost = unit * times;
  const balance = user.wallet[costItem] ?? 0;
  if (balance < totalCost) throw new DrawError(400, 'Insufficient currency');

  // 全服累积保底（server_pity）：服务端读写，客户端不可影响。
  let serverPityTriggered = false;
  let forceRarity: string | undefined;
  const sp = pool.serverPity;
  let spCount = 0;
  if (sp && sp.enabled) {
    spCount = await getServerPity(db, poolId);
    if (spCount >= sp.threshold) {
      serverPityTriggered = true;
      forceRarity = sp.rewardRarity;
    }
  }

  // 服务端权威随机：createRng() 使用 crypto.getRandomValues。
  const rand = createRng();
  const { results, pityState } = roll(pool, user.pity, times, {
    rand,
    forceRarity,
  });

  // 扣费
  user.wallet[costItem] = balance - totalCost;

  // 积分卡池（C2）：每抽累加荣耀积分，用于指定 UR 兑换。
  if (pool.pointsPerDraw) {
    user.wallet.point_wz = (user.wallet.point_wz ?? 0) + pool.pointsPerDraw * times;
  }

  // 结算掉落：货币扇区直接入钱包；卡牌首次进图鉴，重复卡转化为升星碎片。
  // 缺了碎片这条，抽到重复卡就是纯浪费，升星链路会直接断掉。
  const now = Date.now();
  for (const r of results) {
    const currencyGain = CURRENCY_GAIN[r.itemId];
    if (currencyGain !== undefined) {
      user.wallet[r.itemId] = (user.wallet[r.itemId] ?? 0) + currencyGain;
      continue;
    }
    const prev = user.inventory[r.itemId];
    const isFirst = !prev || prev.count === 0;
    if (isFirst) {
      user.codex[r.itemId] = { firstAt: now, rarity: r.rarity, name: r.name };
    } else {
      user.wallet.fragments = (user.wallet.fragments ?? 0) + dupFragmentGain(r.rarity);
    }
    const inv = prev ?? { count: 0, rarity: r.rarity, star: 0, name: r.name };
    inv.count += 1;
    inv.rarity = r.rarity;
    inv.name = r.name;
    user.inventory[r.itemId] = inv;
  }

  user.pity = pityState;
  user.power = computePower(user.inventory);
  user.updated_at = now;

  // 写历史（批量）
  const historyRows = results.map((r) => ({
    openid,
    pool_id: poolId,
    pool_name: pool.name,
    item_id: r.itemId,
    name: r.name,
    rarity: r.rarity,
    at: now,
  }));
  await insertHistoryBatch(db, historyRows);

  // 更新全服保底计数
  if (sp && sp.enabled) {
    if (serverPityTriggered) {
      await setServerPity(db, poolId, 0);
    } else {
      await setServerPity(db, poolId, spCount + times);
    }
  }

  // 落库用户
  await saveUser(db, user);

  // 记录幂等 token（仅当提供了 clientToken）
  if (clientToken) {
    await insertDrawToken(db, clientToken, openid);
  }

  return {
    results,
    pityState,
    wallet: user.wallet,
    power: user.power,
    serverPityTriggered,
  };
}
