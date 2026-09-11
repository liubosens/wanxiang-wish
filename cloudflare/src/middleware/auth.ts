import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types';
import { verifyToken } from '../auth';

// Bearer JWT 校验中间件。缺/错/过期均返回 401（AC-06）。
// 校验通过后把 openid 写入上下文变量，供后续 handler 使用。
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ message: 'Missing or invalid Authorization header' }, 401);
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = await verifyToken(c.env.JWT_SECRET, token);
  if (!payload || typeof payload.sub !== 'string') {
    return c.json({ message: 'Invalid or expired token' }, 401);
  }
  c.set('openid', payload.sub);
  await next();
});
