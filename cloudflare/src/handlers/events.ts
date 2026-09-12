import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getEventsForDisplay } from '../services/events';

// GET /api/events - 当前生效活动 + 未来 7 天预告（仅供 UI 展示；
// 活动生效逻辑不靠此端点——各结算 handler 内部调 getActiveEvent 判定，events-spec §6）。
export async function listEventsHandler(c: Context<AppEnv>) {
  const data = await getEventsForDisplay(c.env.DB, c.env.KV);
  return c.json(data);
}
