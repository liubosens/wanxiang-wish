/**
 * 战力 / 升星 / 碎片 统一常量与公式（client 端权威实现）
 * 服务端 cloudfunctions/<fn>/power.js 为同一份逻辑的部署副本，
 * 修改公式时务必同步两处（见 docs/architecture/architecture.md ADR）。
 */

// 稀有度倍率（升星成本用）
const RAR_MULT = { R: 1, SR: 2, UR: 3 };
// 战力权重（战力公式用）
const RAR_WEIGHT = { R: 10, SR: 30, UR: 80 };
// 重复卡转化碎片（抽到重复时入 wallet.fragments）
const DUP_FRAG = { R: 5, SR: 30, UR: 80 };

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
 * @param {string} rarity R/SR/UR
 * @param {number} currentStar 当前星(0-4)
 * @returns {{fragments:number, stone:number, nextStar:number}}
 */
function upgradeCost(rarity, currentStar) {
  const s = currentStar || 0;
  const m = rarMult(rarity);
  const fragments = 10 * (s + 1) * m;
  // 目标星 ≥3 时额外消耗进阶石
  const nextStar = s + 1;
  const stone = nextStar >= 3 ? (nextStar - 2) * m : 0;
  return { fragments, stone, nextStar };
}

/**
 * 战力 = 编队最优 5 张已拥有卡 rarWeight × (1 + 0.25 × star) 之和
 * inventory: { [itemId]: { count, star, rarity, ... } }
 */
function computePower(inventory) {
  const owned = Object.keys(inventory || {})
    .map((id) => inventory[id])
    .filter((it) => it && (it.count || 0) > 0);
  const scored = owned
    .map((it) => rarWeight(it.rarity) * (1 + 0.25 * (it.star || 0)))
    .sort((a, b) => b - a);
  return Math.round(scored.slice(0, 5).reduce((s, v) => s + v, 0));
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
