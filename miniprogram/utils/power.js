/**
 * 战力 / 升星 / 碎片 统一常量与公式（client 端权威实现）
 * 服务端 cloudfunctions/<fn>/power.js 为同一份逻辑的部署副本，
 * 修改公式时务必同步两处（见 docs/architecture/architecture.md ADR）。
 * 另与 web/core/power.js、cloudflare/src/power.ts 同源（H5 + Cloudflare 路径）。
 */
const { bondBonus } = require('./bonds-config.js');

// 稀有度倍率（升星成本用）。SSR 档为 [PLACEHOLDER] 待数值校准。
// SSR=2.5 非整数倍率：fragments 恒为整数，stone 在 upgradeCost 内取整兜底。
const RAR_MULT = { R: 1, SR: 2, SSR: 2.5, UR: 3 };
// 战力权重（战力公式用）。SSR=50 定位介于 SR 与 UR 之间。
const RAR_WEIGHT = { R: 10, SR: 30, SSR: 50, UR: 80 };
// 重复卡转化碎片（抽到重复时入 wallet.fragments）
const DUP_FRAG = { R: 5, SR: 30, SSR: 40, UR: 80 };

function rarMult(rarity) {
  return RAR_MULT[rarity] || 1;
}
function rarWeight(rarity) {
  return RAR_WEIGHT[rarity] || 0;
}
function dupFragmentGain(rarity) {
  return DUP_FRAG[rarity] || 0;
}

/**
 * 升到 s+1 星的成本
 * @param {string} rarity R/SR/SSR/UR
 * @param {number} currentStar 当前星(0-4)
 * @returns {{fragments:number, stone:number, nextStar:number}}
 */
function upgradeCost(rarity, currentStar) {
  const s = currentStar || 0;
  const m = rarMult(rarity);
  const fragments = 10 * (s + 1) * m;
  // 目标星 ≥3 时额外消耗进阶石。SSR 非整数倍率会产生 2.5/7.5，统一取整
  // （整数倍率 R/SR/UR 下 Math.round 为原值，不影响既有数值）。
  const nextStar = s + 1;
  const stone = nextStar >= 3 ? Math.round((nextStar - 2) * m) : 0;
  return { fragments, stone, nextStar };
}

/**
 * 战力 = 编队最优 5 张已拥有卡 rarWeight × (1 + 0.25 × star) 之和，
 * 末尾外乘羁绊加成（拥有即激活，封顶 BOND_CAP），与 H5 / 服务端口径一致。
 * inventory: { [itemId]: { count, star, rarity, ... } }
 */
function computePower(inventory) {
  const owned = Object.keys(inventory || {})
    .map((id) => inventory[id])
    .filter((it) => it && (it.count || 0) > 0);
  const scored = owned
    .map((it) => rarWeight(it.rarity) * (1 + 0.25 * (it.star || 0)))
    .sort((a, b) => b - a);
  const base = Math.round(scored.slice(0, 5).reduce((s, v) => s + v, 0));
  return Math.round(base * (1 + bondBonus(inventory)));
}

module.exports = {
  RAR_MULT,
  RAR_WEIGHT,
  DUP_FRAG,
  rarMult,
  rarWeight,
  dupFragmentGain,
  upgradeCost,
  computePower,
};
