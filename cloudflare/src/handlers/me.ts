import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getUser } from '../db';

// GET /api/me - 当前用户完整档案（wallet / inventory / codex / pity / power）。
// 客户端背包、图鉴、保底展示都以此为唯一数据源。
export async function meHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const user = await getUser(c.env.DB, openid);
  if (!user) return c.json({ message: 'User not initialized' }, 401);
  return c.json({ user });
}
