import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { challengeTower, getTowerInfo, sweepTower, TowerError } from '../services/tower';

// GET /api/tower - 塔状态 + 下一层守将（服务端权威）。
export async function getTowerHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const info = await getTowerInfo(c.env.DB, openid, c.env.KV);
  return c.json(info);
}

// POST /api/tower/challenge { clientToken? } - 挑战下一层（clientToken 幂等防双扣次数）。
export async function challengeTowerHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const body = await c.req.json<{ clientToken?: unknown }>().catch(() => null);
  const clientToken = typeof body?.clientToken === 'string' && body.clientToken ? body.clientToken : undefined;
  try {
    const result = await challengeTower(c.env.DB, openid, clientToken, c.env.KV);
    return c.json(result);
  } catch (e) {
    if (e instanceof TowerError) return c.json({ message: e.message }, e.status as 400);
    throw e;
  }
}

// POST /api/tower/sweep - 每日扫荡已通最高层 1 次。
export async function sweepTowerHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  try {
    const result = await sweepTower(c.env.DB, openid, c.env.KV);
    return c.json(result);
  } catch (e) {
    if (e instanceof TowerError) return c.json({ message: e.message }, e.status as 400);
    throw e;
  }
}
