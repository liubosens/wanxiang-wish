import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getUser, saveUser } from '../db';
import { createRng } from '../roll-engine';
import { bumpQuestProgress, todayCN } from '../services/quests';

const WIN_REWARD_STONE = 5;
const WIN_REWARD_ADVANCE = 1;
// PK 每日奖励上限（2026-09 拍板，competitive-spec §7）：每日仅前 N 胜发奖，
// 超限仍可无限 PK、战绩照记，但不发奖——堵无限刷进阶石漏洞。N=[PLACEHOLDER] 待校准。
const DAILY_REWARDED_WINS_CAP = 5;

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

  // 每日发奖胜场上限：跨日自动清零（pk_reward_date 不是今天即视为 0）。
  const today = todayCN();
  const rewardedWinsToday = user.pk_reward_date === today ? (user.pk_reward_wins || 0) : 0;
  let rewardGranted = false;

  if (win) {
    if (rewardedWinsToday < DAILY_REWARDED_WINS_CAP) {
      user.wallet.wish_stone = (user.wallet.wish_stone ?? 0) + WIN_REWARD_STONE;
      user.wallet.stone = (user.wallet.stone ?? 0) + WIN_REWARD_ADVANCE;
      user.pk_reward_date = today;
      user.pk_reward_wins = rewardedWinsToday + 1;
      rewardGranted = true;
    }
    user.pk_win = (user.pk_win || 0) + 1;
  } else {
    user.pk_lose = (user.pk_lose || 0) + 1;
  }
  user.updated_at = Date.now();
  await saveUser(c.env.DB, user);

  // 任务埋点：参与计数（d_pk3）+ 胜利计数（w_pk10）。超上限后 PK 仍计数任务（拍板口径）。
  await bumpQuestProgress(c.env.DB, openid, 'pk_attempt', 1);
  if (win) await bumpQuestProgress(c.env.DB, openid, 'pk_win', 1);

  return c.json({
    win,
    myVal: Math.round(myVal),
    oppVal: Math.round(oppVal),
    oppName,
    oppPower,
    wallet: user.wallet,
    pkWin: user.pk_win,
    pkLose: user.pk_lose,
    rewardGranted,
    rewardedWinsToday: user.pk_reward_date === today ? user.pk_reward_wins : rewardedWinsToday,
    dailyRewardCap: DAILY_REWARDED_WINS_CAP,
  });
}
