/**
 * 战力 / 升星 / 碎片 统一常量与公式（cloudfunctions/exchange 部署副本）
 * 与 miniprogram/utils/power.js 保持同步。
 */
const RAR_MULT = { R: 1, SR: 2, UR: 3 };
const RAR_WEIGHT = { R: 10, SR: 30, UR: 80 };
const DUP_FRAG = { R: 5, SR: 30, UR: 80 };
function rarMult(r) { return RAR_MULT[r] || 1; }
function rarWeight(r) { return RAR_WEIGHT[r] || 0; }
function dupFragmentGain(r) { return DUP_FRAG[r] || 0; }
function upgradeCost(rarity, currentStar) {
  const s = currentStar || 0; const m = rarMult(rarity);
  const fragments = 10 * (s + 1) * m; const nextStar = s + 1;
  const stone = nextStar >= 3 ? (nextStar - 2) * m : 0;
  return { fragments, stone, nextStar };
}
function computePower(inventory) {
  const owned = Object.keys(inventory || {}).map((id) => inventory[id]).filter((it) => it && (it.count || 0) > 0);
  const scored = owned.map((it) => rarWeight(it.rarity) * (1 + 0.25 * (it.star || 0))).sort((a, b) => b - a);
  return Math.round(scored.slice(0, 5).reduce((s, v) => s + v, 0));
}
module.exports = { RAR_MULT, RAR_WEIGHT, DUP_FRAG, rarMult, rarWeight, dupFragmentGain, upgradeCost, computePower };
