import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from '../types';
import { performDraw, DrawError } from '../services/draw';

// POST /api/draw  - 抽卡 + 保底（服务端权威）。AC-02 / AC-03 / AC-04。
// 本 handler 仅做参数解析、调用 service、把领域错误翻译成 HTTP 状态。
export async function drawHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const body = await c.req
    .json<{ poolId?: unknown; times?: unknown; clientToken?: unknown }>()
    .catch(() => null);

  if (!body || typeof body.poolId !== 'string' || body.poolId.trim().length === 0) {
    return c.json({ message: 'poolId is required' }, 400);
  }
  const poolId = body.poolId.trim();

  const times = Number(body.times ?? 1);
  if (!Number.isInteger(times) || times < 1 || times > 10) {
    return c.json({ message: 'times must be an integer between 1 and 10' }, 400);
  }

  const clientToken = typeof body.clientToken === 'string' ? body.clientToken : undefined;

  try {
    const result = await performDraw(c.env.DB, openid, poolId, times, clientToken, c.env.KV);
    return c.json(result);
  } catch (err) {
    if (err instanceof DrawError) {
      return c.json({ message: err.message }, err.status as ContentfulStatusCode);
    }
    console.error('draw failed', err);
    return c.json({ message: 'Internal server error' }, 500);
  }
}
