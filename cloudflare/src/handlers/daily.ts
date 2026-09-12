import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getUser, saveUser } from '../db';

// 每日补给奖励（服务端权威，客户端不可伪造）。与本地模式 claimDaily 数值一致。
const REWARDS: Record<string, number> = {
  wish_stone: 10,
  chest_key: 3,
  machine_coin: 5,
  dust: 30,
  stone: 1,
};

// 以 UTC+8（北京时间）计算「今天」，避免服务器 UTC 导致跨零点签到日错位。
function todayCN(): string {
  const shifted = new Date(Date.now() + 8 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10); // YYYY-MM-DD
}

// POST /api/daily - 服务端每日签到。同一自然日只能领一次。
export async function dailyHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const user = await getUser(c.env.DB, openid);
  if (!user) return c.json({ message: 'User not initialized' }, 401);

  const today = todayCN();
  if (user.last_daily_at === today) {
    return c.json({
      claimed: false,
      message: '今日补给已领取，明天再来',
      wallet: user.wallet,
      lastDailyAt: user.last_daily_at,
    });
  }

  for (const [key, amount] of Object.entries(REWARDS)) {
    user.wallet[key] = (user.wallet[key] ?? 0) + amount;
  }
  user.last_daily_at = today;
  user.updated_at = Date.now();
  await saveUser(c.env.DB, user);

  return c.json({
    claimed: true,
    rewards: REWARDS,
    wallet: user.wallet,
    lastDailyAt: today,
  });
}
