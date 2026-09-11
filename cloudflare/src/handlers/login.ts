import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getUser, createUser } from '../db';
import { signToken } from '../auth';

// POST /api/login  - 登录/注册（无微信依赖）
// 以 deviceId 定位/创建用户并签发 HS256 JWT。AC-01。
export async function loginHandler(c: Context<AppEnv>) {
  const body = await c.req.json<{ deviceId?: unknown; nickname?: unknown }>().catch(() => null);
  if (
    !body ||
    typeof body.deviceId !== 'string' ||
    body.deviceId.trim().length === 0
  ) {
    return c.json({ message: 'deviceId is required' }, 400);
  }
  const openid = body.deviceId.trim();
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() || null : null;

  const db = c.env.DB;
  let user = await getUser(db, openid);
  if (!user) {
    user = await createUser(db, openid, nickname);
  }

  const token = await signToken(c.env.JWT_SECRET, {
    sub: openid,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  });

  return c.json({ token, user });
}
