/**
 * 战力 / 升星 / 碎片 统一常量与公式（cloudfunctions/upgrade 部署副本）
 * 与 miniprogram/utils/power.js 保持同步。
 * 注：本路径（微信云开发）为早期交付，已由 H5 + Cloudflare 路径取代；
 *     此处仅同步稀有度表与升星公式，羁绊外乘未纳入（见 miniprogram/utils/bonds-config.js）。
 */
// SSR 档为 [PLACEHOLDER] 待数值校准（与 miniprogram/utils/power.js、web/core/power.js 同源）。
// SSR=2.5 非整数倍率：fragments 恒为整数，stone 在 upgradeCost 内取整兜底。
const RAR_MULT = { R: 1, SR: 2, SSR: 2.5, UR: 3 };
const RAR_WEIGHT = { R: 10, SR: 30, SSR: 50, UR: 80 };
const DUP_FRAG = { R: 5, SR: 30, SSR: 40, UR: 80 };
function rarMult(r) { return RAR_MULT[r] || 1; }
function rarWeight(r) { return RAR_WEIGHT[r] || 0; }
function dupFragmentGain(r) { return DUP_FRAG[r] || 0; }
function upgradeCost(rarity, currentStar) {
  const s = currentStar || 0; const m = rarMult(rarity);
  const fragments = 10 * (s + 1) * m; const nextStar = s + 1;
  // 取整兜底：整数倍率下为原值，仅 SSR 2.5 生效。
  const stone = nextStar >= 3 ? Math.round((nextStar - 2) * m) : 0;
  return { fragments, stone, nextStar };
}
function computePower(inventory) {
  const owned = Object.keys(inventory || {}).map((id) => inventory[id]).filter((it) => it && (it.count || 0) > 0);
  const scored = owned.map((it) => rarWeight(it.rarity) * (1 + 0.25 * (it.star || 0))).sort((a, b) => b - a);
  return Math.round(scored.slice(0, 5).reduce((s, v) => s + v, 0));
}
module.exports = { RAR_MULT, RAR_WEIGHT, DUP_FRAG, rarMult, rarWeight, dupFragmentGain, upgradeCost, computePower };
