// 战力 / 升星 / 碎片 统一常量与公式。
// 与 miniprogram/utils/power.js、cloudflare/src/power.ts 同源。
// 改公式时三处必须同步，否则客户端预览与服务端结算会对不上。
import { bondBonus } from './bonds-config.js';

// 稀有度倍率（升星成本用）。SSR 档为 [PLACEHOLDER] 待数值校准。
// 注意：SSR=2.5 为非整数倍率，fragments 公式 10*(s+1)*m 恒为整数（25 的倍数），
// 但 stone 公式 (nextStar-2)*m 会出现 2.5/7.5 —— upgradeCost 内已取整兜底。
export const RAR_MULT = { R: 1, SR: 2, SSR: 2.5, UR: 3 };
// 战力权重（战力公式用）。SSR=50 为 [PLACEHOLDER] 待校准，定位介于 SR 与 UR 之间。
export const RAR_WEIGHT = { R: 10, SR: 30, SSR: 50, UR: 80 };
// 重复卡转化碎片（抽到重复时入 wallet.fragments）。SSR=40 为 [PLACEHOLDER] 待校准。
export const DUP_FRAG = { R: 5, SR: 30, SSR: 40, UR: 80 };

export const MAX_STAR = 5;

export function rarMult(rarity) {
  return RAR_MULT[rarity] || 1;
}

export function rarWeight(rarity) {
  return RAR_WEIGHT[rarity] || 0;
}

export function dupFragmentGain(rarity) {
  return DUP_FRAG[rarity] || 0;
}

/**
 * 升到 s+1 星的成本
 * @param {string} rarity R/SR/SSR/UR
 * @param {number} currentStar 当前星(0-4)
 */
export function upgradeCost(rarity, currentStar) {
  const s = currentStar || 0;
  const m = rarMult(rarity);
  const fragments = 10 * (s + 1) * m;
  const nextStar = s + 1;
  // 目标星 ≥3 时额外消耗进阶石。SSR 非整数倍率会产生 2.5/7.5，统一取整
  // （整数倍率 R/SR/UR 下 Math.round 为原值，不影响既有数值）。
  const stone = nextStar >= 3 ? Math.round((nextStar - 2) * m) : 0;
  return { fragments, stone, nextStar };
}

/**
 * 战力 = 编队最优 5 张已拥有卡 rarWeight × (1 + 0.25 × star) 之和，
 * 末尾外乘羁绊加成（拥有即激活，由 bonds-config 纯函数推导，封顶 BOND_CAP）。
 * inventory: { [itemId]: { count, star, rarity, ... } }
 */
export function computePower(inventory) {
  const owned = Object.keys(inventory || {})
    .map((id) => inventory[id])
    .filter((it) => it && (it.count || 0) > 0);
  const scored = owned
    .map((it) => rarWeight(it.rarity) * (1 + 0.25 * (it.star || 0)))
    .sort((a, b) => b - a);
  const base = Math.round(scored.slice(0, 5).reduce((s, v) => s + v, 0));
  return Math.round(base * (1 + bondBonus(inventory)));
}
