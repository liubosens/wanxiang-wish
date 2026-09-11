import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getPool, listPools } from '../pools';

// GET /api/pools  - 卡池列表（摘要）
export async function listPoolsHandler(c: Context<AppEnv>) {
  return c.json({ pools: listPools() });
}

// GET /api/pools/:poolId  - 卡池完整配置
export async function getPoolHandler(c: Context<AppEnv>) {
  const poolId = c.req.param('poolId');
  if (!poolId) {
    return c.json({ message: 'Pool not found' }, 404);
  }
  const pool = getPool(poolId);
  if (!pool) {
    return c.json({ message: 'Pool not found' }, 404);
  }
  return c.json(pool);
}
