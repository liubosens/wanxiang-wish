// 试炼塔曲线校准工具（design/gdd/trial-tower-spec.md §1.2 校准方法）
//
// 用法：
//   1) 导出线上 power 分布：
//      cd cloudflare && npx wrangler d1 execute wanxiang-wish --remote \
//        --command="SELECT power FROM users" --json > ../.calib/users.json
//   2) 跑本脚本：
//      node tools/calibrate-tower.mjs ../.calib/users.json
//
// 校准逻辑：层 10 = 全服 power P25、层 20 = P50、层 30 = P75、层 40 = P95，
// 反解几何曲线 enemyPower(n) = pMin × (pMax/pMin)^((n-1)/(floorMax-1)) 的锚点。
// 输出建议 pMin/pMax 与各层敌力预览；样本不足（<30）时拒绝给建议，避免噪声锚点。

import fs from 'node:fs';

const FLOOR_MAX = 50;
const MIN_SAMPLE = 30;

const file = process.argv[2];
if (!file) {
  console.error('用法: node tools/calibrate-tower.mjs <wrangler --json 导出的 users.json>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = Array.isArray(raw) ? (raw[0]?.results ?? []) : (raw.results ?? []);
const powers = rows
  .map((r) => Number(r.power))
  .filter((n) => Number.isFinite(n) && n > 0)
  .sort((a, b) => a - b);

console.log(`样本数: ${powers.length}`);
if (powers.length === 0) {
  console.log('结论: 线上暂无有效用户数据，无法校准。等有真实玩家后再跑。');
  process.exit(0);
}

function quantile(arr, q) {
  const pos = (arr.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return arr[lo];
  return arr[lo] + (arr[hi] - arr[lo]) * (pos - lo);
}

const P = (q) => Math.round(quantile(powers, q));
const p25 = P(0.25), p50 = P(0.5), p75 = P(0.75), p95 = P(0.95);
console.log(`分位数: P25=${p25}  P50=${p50}  P75=${p75}  P95=${p95}  max=${powers[powers.length - 1]}`);

if (powers.length < MIN_SAMPLE) {
  console.log(`结论: 样本 < ${MIN_SAMPLE}，分位数不稳定，不建议据此改锚点。`);
  console.log('建议: 保持当前锚点，等样本充足后重跑。');
  process.exit(0);
}

// 以层 10=P25、层 40=P95 反解几何曲线（两点定一条几何曲线，中间层自动落在 P50/P75 附近）
// e(n) = pMin × r^((n-1)/(N-1))，其中 r = pMax/pMin 且 e(N) = pMax（顶层敌力）。
const n1 = 10, n2 = 40;
const r = Math.pow(p95 / p25, 1 / ((n2 - 1) / (FLOOR_MAX - 1) - (n1 - 1) / (FLOOR_MAX - 1)));
const pMin = Math.round(p25 / Math.pow(r, (n1 - 1) / (FLOOR_MAX - 1)));
const pMax = Math.round(pMin * r); // e(50) = pMin × r^((50-1)/49) = pMin × r

const curve = (n) => Math.round(pMin * Math.pow(pMax / pMin, (n - 1) / (FLOOR_MAX - 1)));
console.log('\n建议锚点（写入 cloudflare/src/tower-config.ts 的 TOWER.pMin / TOWER.pMax）：');
console.log(`  pMin: ${pMin}`);
console.log(`  pMax: ${pMax}`);
console.log('\n各锚点层校验（目标 = 对应分位数）：');
for (const [n, target, label] of [[10, p25, 'P25'], [20, p50, 'P50'], [30, p75, 'P75'], [40, p95, 'P95']]) {
  const got = curve(n);
  const dev = ((got - target) / target * 100).toFixed(1);
  console.log(`  层 ${n}: 曲线 ${got} vs ${label} ${target}（偏差 ${dev}%）`);
}
console.log(`\n顶层 ${FLOOR_MAX} 敌力 = ${curve(FLOOR_MAX)}（理论满配 900 × 羁绊 1.15 ≈ 1035 的参考）`);
console.log('\n注意：改锚点后 best_floor 超顶的老玩家进度不回退（trial-tower-spec §5.4）。');
