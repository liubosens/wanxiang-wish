import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getUser } from '../db';
import { claimQuest, getQuestsState, QuestError } from '../services/quests';

// GET /api/quests - 任务/成就全量状态（服务端唯一真相源，客户端只读展示）。
export async function listQuestsHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const user = await getUser(c.env.DB, openid);
  if (!user) return c.json({ message: 'User not initialized' }, 401);
  const state = await getQuestsState(c.env.DB, user, c.env.KV);
  return c.json(state);
}

// POST /api/quests/claim { questId } - 领奖（幂等：重复领取返回当前态，弱网重试友好）。
export async function claimQuestHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const body = await c.req.json<{ questId?: unknown }>().catch(() => null);
  if (!body || typeof body.questId !== 'string' || body.questId.trim().length === 0) {
    return c.json({ message: 'questId is required' }, 400);
  }
  try {
    const result = await claimQuest(c.env.DB, openid, body.questId.trim(), c.env.KV);
    return c.json(result);
  } catch (e) {
    if (e instanceof QuestError) return c.json({ message: e.message }, e.status as 400);
    throw e;
  }
}
