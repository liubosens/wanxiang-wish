// 战力 / 升星 / 碎片 统一常量与公式 - 移植自 cloudfunctions/draw/power.js
// 与 miniprogram/utils/power.js 同源公式，用于服务端权威计算战力。

import type { Inventory } from './types';
import { bondBonus } from './bonds-config';

// SSR 档为 [PLACEHOLDER] 待数值校准（定位介于 SR 与 UR 之间）。
// SSR=2.5 非整数倍率：fragments 公式 10*(s+1)*m 恒为整数，stone 公式在 upgradeCost 内取整兜底。
const RAR_MULT: Record<string, number> = { R: 1, SR: 2, SSR: 2.5, UR: 3 };
const RAR_WEIGHT: Record<string, number> = { R: 10, SR: 30, SSR: 50, UR: 80 };
const DUP_FRAG: Record<string, number> = { R: 5, SR: 30, SSR: 40, UR: 80 };

function rarMult(rarity: string): number {
  return RAR_MULT[rarity] || 1;
}
function rarWeight(rarity: string): number {
  return RAR_WEIGHT[rarity] || 0;
}
function dupFragmentGain(rarity: string): number {
  return DUP_FRAG[rarity] || 0;
}
function upgradeCost(rarity: string, currentStar?: number) {
  const s = currentStar || 0;
  const m = rarMult(rarity);
  const fragments = 10 * (s + 1) * m;
  const nextStar = s + 1;
  // SSR 非整数倍率会产生 2.5/7.5 进阶石，统一取整（整数倍率下为原值，不影响既有数值）。
  const stone = nextStar >= 3 ? Math.round((nextStar - 2) * m) : 0;
  return { fragments, stone, nextStar };
}
function computePower(inventory: Inventory): number {
  const owned = Object.keys(inventory || {})
    .map((id) => inventory[id])
    .filter((it) => it && (it.count || 0) > 0);
  const scored = owned
    .map((it) => rarWeight(it.rarity) * (1 + 0.25 * (it.star || 0)))
    .sort((a, b) => b - a);
  const base = Math.round(scored.slice(0, 5).reduce((s, v) => s + v, 0));
  // 羁绊外乘（拥有即激活，bonds-config 纯函数推导，封顶 BOND_CAP），与 web/core/power.js 同源。
  return Math.round(base * (1 + bondBonus(inventory)));
}

export {
  RAR_MULT,
  RAR_WEIGHT,
  DUP_FRAG,
  rarMult,
  rarWeight,
  dupFragmentGain,
  upgradeCost,
  computePower,
};
