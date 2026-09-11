import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getUser, saveUser } from '../db';
import { createRng } from '../roll-engine';

const WIN_REWARD_STONE = 5;
const WIN_REWARD_ADVANCE = 1;

// POST /api/pk - 对战结算（服务端权威）。
// opponentId 两种形态：排行榜内置对手 "bot|<名字>|<战力>"，或真实用户 openid。
// 胜负由双方战力 ×(0.85~1.15) 方差决定，随机源取自服务端，客户端无法预判。
export async function pkHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const body = await c.req.json<{ opponentId?: unknown }>().catch(() => null);
  const rawOpponentId = typeof body?.opponentId === 'string' ? body.opponentId : '';

  const user = await getUser(c.env.DB, openid);
  if (!user) return c.json({ message: 'User not initialized' }, 401);
  const myPower = user.power;

  let oppName = '对手';
  let oppPower = myPower;

  if (rawOpponentId.startsWith('bot|')) {
    const parts = rawOpponentId.split('|');
    oppName = parts[1] || '对手';
    oppPower = Number(parts[2]) || myPower;
  } else if (rawOpponentId) {
    const other = await getUser(c.env.DB, rawOpponentId);
    if (!other) return c.json({ message: '对手不存在' }, 404);
    oppName = other.nick_name || '玩家';
    oppPower = other.power;
  }

  const rand = createRng();
  const variance = () => 0.85 + 0.3 * rand();
  const myVal = myPower * variance();
  const oppVal = oppPower * variance();
  const win = myVal >= oppVal;

  if (win) {
    user.wallet.wish_stone = (user.wallet.wish_stone ?? 0) + WIN_REWARD_STONE;
    user.wallet.stone = (user.wallet.stone ?? 0) + WIN_REWARD_ADVANCE;
  }
  user.updated_at = Date.now();
  await saveUser(c.env.DB, user);

  return c.json({
    win,
    myVal: Math.round(myVal),
    oppVal: Math.round(oppVal),
    oppName,
    oppPower,
    wallet: user.wallet,
  });
}
