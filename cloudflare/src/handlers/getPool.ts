import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getPool, listPools } from '../pools';
import { getActiveEvent } from '../services/events';

// GET /api/pools  - 卡池列表（摘要）
export async function listPoolsHandler(c: Context<AppEnv>) {
  return c.json({ pools: listPools() });
}

// GET /api/pools/:poolId  - 卡池完整配置
// UP 轮换活动生效时替换 up.itemIds 与标题（保底计数跨轮换继承——2026-09 拍板，文案必须明示）。
export async function getPoolHandler(c: Context<AppEnv>) {
  const poolId = c.req.param('poolId');
  if (!poolId) {
    return c.json({ message: 'Pool not found' }, 404);
  }
  const pool = getPool(poolId);
  if (!pool) {
    return c.json({ message: 'Pool not found' }, 404);
  }

  const upRotation = await getActiveEvent(c.env.DB, 'up_rotation', c.env.KV);
  const baseNotes = Array.isArray(pool.ratePublic?.notes)
    ? (pool.ratePublic.notes as string[])
    : [];
  if (
    upRotation &&
    upRotation.payload?.poolId === poolId &&
    pool.up &&
    Array.isArray(upRotation.payload?.upItemIds) &&
    (upRotation.payload.upItemIds as unknown[]).length > 0
  ) {
    return c.json({
      ...pool,
      name: typeof upRotation.payload.bannerTitle === 'string' ? upRotation.payload.bannerTitle : pool.name,
      up: { ...pool.up, itemIds: upRotation.payload.upItemIds as string[] },
      ratePublic: {
        ...pool.ratePublic,
        notes: [
          ...baseNotes,
          '本期为限定 UP 轮换池。UP 轮换不重置保底计数，大保底状态跨期继承。',
        ],
      },
      event: { id: upRotation.id, title: upRotation.title, endAt: upRotation.endAt },
    });
  }

  // 常驻 UP 池（a1_genshin_v1）也固定展示保底继承规则（规则级承诺，用户可见）
  if (pool.up?.enabled) {
    return c.json({
      ...pool,
      ratePublic: {
        ...pool.ratePublic,
        notes: [
          ...baseNotes,
          'UP 轮换不重置保底计数，大保底状态跨期继承。',
        ],
      },
    });
  }

  return c.json(pool);
}
