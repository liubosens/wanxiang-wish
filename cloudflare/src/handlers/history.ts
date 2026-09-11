import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getHistory } from '../db';

// GET /api/history  - 抽卡历史（按用户倒序分页）
// ?limit= 可选，默认 50，上限 100（防全量加载，性能门禁）。
export async function historyHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const raw = c.req.query('limit');
  const limit = Math.min(Math.max(Number(raw) || 50, 1), 100);
  const rows = await getHistory(c.env.DB, openid, limit);
  return c.json({ rows });
}
