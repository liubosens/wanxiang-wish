import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getPool } from '../pools';
import { getUser, saveUser } from '../db';
import { computePower } from '../power';

// POST /api/exchange - C2 荣耀积分兑换指定 UR（服务端权威）。
// 积分与背包均以库中数据为准，客户端只提交 poolId。
export async function exchangeHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const body = await c.req.json<{ poolId?: unknown }>().catch(() => null);
  if (!body || typeof body.poolId !== 'string' || body.poolId.trim().length === 0) {
    return c.json({ message: 'poolId is required' }, 400);
  }
  const poolId = body.poolId.trim();

  const pool = getPool(poolId);
  if (!pool) return c.json({ message: 'Pool not found' }, 404);

  const ex = pool.exchange;
  if (!ex || !ex.itemId) return c.json({ message: '该卡池不支持兑换' }, 400);

  const user = await getUser(c.env.DB, openid);
  if (!user) return c.json({ message: 'User not initialized' }, 401);

  const cost = ex.cost ?? 0;
  const points = user.wallet.point_wz ?? 0;
  if (points < cost) return c.json({ message: '荣耀积分不足' }, 400);

  const now = Date.now();
  user.wallet.point_wz = points - cost;

  const rarity = 'UR';
  const prev = user.inventory[ex.itemId];
  const isFirst = !prev || prev.count === 0;
  const inv = prev ?? { count: 0, rarity, star: 0, name: ex.name };
  inv.count += 1;
  inv.rarity = rarity;
  inv.name = ex.name;
  user.inventory[ex.itemId] = inv;
  if (isFirst) {
    user.codex[ex.itemId] = { firstAt: now, rarity, name: ex.name };
  }

  user.power = computePower(user.inventory);
  user.updated_at = now;
  await saveUser(c.env.DB, user);

  return c.json({
    item: { itemId: ex.itemId, name: ex.name, rarity },
    wallet: user.wallet,
    power: user.power,
  });
}
