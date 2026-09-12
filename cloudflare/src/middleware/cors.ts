import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types';

// 允许跨域。H5 站点与 Capacitor WebView 的 Origin 都和服务端不同域：
//   - 浏览器 H5：https://<pages 域名>
//   - Capacitor Android：http://localhost 或 https://localhost
// 鉴权走 Authorization Bearer（非 Cookie），放开 Origin 不引入 CSRF 风险。
export const corsMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const origin = c.req.header('Origin') || '*';
  c.header('Access-Control-Allow-Origin', origin);
  c.header('Vary', 'Origin');
  c.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Max-Age', '86400');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});
