import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { deleteUser } from '../db';

const LEADERBOARD_CACHE_KEY = 'leaderboard:top50';

// DELETE /api/account - 账号注销：清空该用户的服务端全部数据（档案 / 记录 / 幂等 token）。
// 不可逆。客户端需二次确认；调用后本地应清 token 并生成新 deviceId。
export async function accountHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  await deleteUser(c.env.DB, openid);
  await c.env.KV.delete(LEADERBOARD_CACHE_KEY).catch(() => {});
  return c.json({ ok: true });
}
