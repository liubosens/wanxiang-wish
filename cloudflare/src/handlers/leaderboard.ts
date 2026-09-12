import type { Context } from 'hono';
import type { AppEnv, LeaderboardRow } from '../types';
import { getUser, getLeaderboardTop, countUsersWithPowerGt } from '../db';

const CACHE_KEY = 'leaderboard:top50';
const CACHE_TTL = 60; // seconds; Cloudflare KV 要求 expirationTtl 最小为 60

// GET /api/leaderboard  - 我的排名 + 前 50 名快照。AC-05。
// 全局 top50 走 KV 缓存（TTL 30s，降低热点聚合压力）；me 部分每次实时计算。
export async function leaderboardHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const db = c.env.DB;

  const me = await getUser(db, openid);
  if (!me) {
    return c.json({ message: 'User not initialized' }, 401);
  }
  const myPower = me.power;

  const cached = await c.env.KV.get(CACHE_KEY, 'json');
  let rows: LeaderboardRow[] | null = cached ? (cached as LeaderboardRow[]) : null;
  if (!rows) {
    const top = await getLeaderboardTop(db, 50);
    rows = top.map((u, i) => ({
      rank: i + 1,
      id: u.openid,
      name: u.nick_name || '玩家',
      avatar: u.avatar ?? null,
      power: u.power,
      isMe: u.openid === openid,
    }));
    await c.env.KV.put(CACHE_KEY, JSON.stringify(rows), { expirationTtl: CACHE_TTL });
  } else {
    // 缓存为全局快照，需按当前请求者重算 isMe。
    rows = rows.map((r) => ({ ...r, isMe: r.id === openid }));
  }

  const above = await countUsersWithPowerGt(db, myPower);
  const myRank = above + 1;

  return c.json({ me: { rank: myRank, power: myPower }, rows });
}
