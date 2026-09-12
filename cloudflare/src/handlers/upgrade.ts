import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getUser, saveUser } from '../db';
import { computePower, upgradeCost } from '../power';
import { bumpQuestProgress } from '../services/quests';

const MAX_STAR = 5;

// POST /api/upgrade - 卡牌升星（服务端权威）。
// 消耗升星碎片；目标星 ≥3 时额外消耗进阶石。公式与客户端 power.js 同源。
export async function upgradeHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const body = await c.req.json<{ itemId?: unknown }>().catch(() => null);
  if (!body || typeof body.itemId !== 'string' || body.itemId.trim().length === 0) {
    return c.json({ message: 'itemId is required' }, 400);
  }
  const itemId = body.itemId.trim();

  const user = await getUser(c.env.DB, openid);
  if (!user) return c.json({ message: 'User not initialized' }, 401);

  const inv = user.inventory[itemId];
  if (!inv || inv.count === 0) return c.json({ message: '尚未拥有该卡' }, 400);

  const star = inv.star ?? 0;
  if (star >= MAX_STAR) return c.json({ message: '已满星' }, 400);

  const cost = upgradeCost(inv.rarity, star);
  const fragments = user.wallet.fragments ?? 0;
  const stone = user.wallet.stone ?? 0;
  if (fragments < cost.fragments) return c.json({ message: '升星碎片不足' }, 400);
  if (stone < cost.stone) return c.json({ message: '进阶石不足' }, 400);

  user.wallet.fragments = fragments - cost.fragments;
  user.wallet.stone = stone - cost.stone;
  inv.star = cost.nextStar;
  user.inventory[itemId] = inv;

  user.power = computePower(user.inventory);
  user.updated_at = Date.now();
  await saveUser(c.env.DB, user);

  // 任务埋点：升星计数（d_upgrade1）
  await bumpQuestProgress(c.env.DB, openid, 'upgrade', 1);

  return c.json({
    item: { itemId, name: inv.name, rarity: inv.rarity, star: inv.star },
    wallet: user.wallet,
    power: user.power,
  });
}
