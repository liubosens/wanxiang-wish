import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { getUser } from '../db';
import { bondStates, bondBonusSum, BOND_CAP } from '../bonds-config';

// GET /api/bonds - 羁绊定义 + 当前激活态（由 inventory 实时推导）。
// 无 POST 端点：激活是拥有卡的推导结果，不存在"领羁绊"动作，也就无刷取面。
export async function bondsHandler(c: Context<AppEnv>) {
  const openid = c.get('openid');
  const user = await getUser(c.env.DB, openid);
  if (!user) return c.json({ message: 'User not initialized' }, 401);
  const inventory = user.inventory || {};
  return c.json({
    bonds: bondStates(inventory),
    totalBonus: Math.min(bondBonusSum(inventory), BOND_CAP),
    cap: BOND_CAP,
  });
}
