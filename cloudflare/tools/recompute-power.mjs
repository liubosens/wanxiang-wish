// 存量 users.power 重算工具（零依赖，node 直跑）
//
// 背景：users.power 由服务端在 draw/upgrade/exchange 时用 computePower 重算落库，
// 数值表变更（如 SSR 补键、羁绊外乘上线）后**不会主动刷新**——只在玩家下次动作时自愈。
// 排行榜与 PK 在自愈前会用旧值。本工具做一次性批量重算。
//
// 用法：
//   1) 导出（注意先清代理变量，否则 D1 import 会报 auth error）：
//      cd cloudflare
//      npx wrangler d1 execute wanxiang-wish --remote \
//        --command="SELECT openid, power, inventory FROM users" --json > ../.calib/users-full.json
//   2) 生成 SQL：
//      node tools/recompute-power.mjs ../.calib/users-full.json ../.calib/recompute.sql
//   3) 执行：
//      npx wrangler d1 execute wanxiang-wish --remote --file=../.calib/recompute.sql
//
// 公式与 src/power.ts / web/core/power.js 同源（含羁绊外乘），改公式时须同步本文件。

import fs from 'node:fs';
import path from 'node:path';

// ---- 与 src/power.ts 同源的常量与公式 ----
const RAR_WEIGHT = { R: 10, SR: 30, SSR: 50, UR: 80 }; // [PLACEHOLDER]
const BOND_CAP = 0.15; // [PLACEHOLDER]
const BONDS = [
  ['genshin_ying', 'genshin_kong', 'genshin_wendy'],
  ['genshin_hutao', 'genshin_zhongli'],
  ['genshin_raiden', 'genshin_nahida', 'genshin_ayaka'],
  ['sg_liubei', 'sg_guanyu', 'sg_zhangfei'],
  ['sg_zhouyu', 'sg_zhugeliang', 'sg_huang'],
  ['sg_lvbu', 'sg_zuoci'],
  ['wz_hualan', 'wz_luona'],
  ['wz_libai', 'wz_gongsun'],
  ['wz_yingzheng', 'wz_wuze'],
];
const BONUS = [0.02, 0.03, 0.05, 0.03, 0.04, 0.04, 0.02, 0.03, 0.05];

function bondBonus(inventory) {
  let sum = 0;
  for (let i = 0; i < BONDS.length; i += 1) {
    if (BONDS[i].every((id) => (inventory?.[id]?.count || 0) > 0)) sum += BONUS[i];
  }
  return Math.min(sum, BOND_CAP);
}

function computePower(inventory) {
  const owned = Object.keys(inventory || {})
    .map((id) => inventory[id])
    .filter((it) => it && (it.count || 0) > 0);
  const scored = owned
    .map((it) => (RAR_WEIGHT[it.rarity] || 0) * (1 + 0.25 * (it.star || 0)))
    .sort((a, b) => b - a);
  const base = Math.round(scored.slice(0, 5).reduce((s, v) => s + v, 0));
  return Math.round(base * (1 + bondBonus(inventory)));
}

// ---- 自检：与 src/power.ts 的三组代表值对账（任一对不上则拒绝执行） ----
function selfCheck() {
  const cases = [
    ['空', {}, 0],
    ['单UR', { genshin_raiden: { count: 1, star: 0, rarity: 'UR' } }, 80],
    ['SSR卡', { ssr_nova: { count: 1, star: 0, rarity: 'SSR' } }, 50],
    ['尘世闲游', {
      genshin_ying: { count: 1, star: 0, rarity: 'R' },
      genshin_kong: { count: 1, star: 0, rarity: 'R' },
      genshin_wendy: { count: 1, star: 0, rarity: 'R' },
    }, 31],
  ];
  for (const [name, inv, want] of cases) {
    const got = computePower(inv);
    if (got !== want) {
      console.error(`自检失败 [${name}]: got ${got}, want ${want} —— 公式与 src/power.ts 不同步，终止。`);
      process.exit(1);
    }
  }
  console.log('自检通过（4 组代表值与 src/power.ts 一致）');
}
selfCheck();

// ---- 主流程 ----
const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error('用法: node tools/recompute-power.mjs <users-full.json> <out.sql>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const rows = Array.isArray(raw) ? (raw[0]?.results ?? []) : (raw.results ?? []);

let changed = 0, skipped = 0;
const lines = ['-- 存量 users.power 重算（由 tools/recompute-power.mjs 生成）', 'BEGIN;'];

for (const r of rows) {
  let inv;
  try {
    inv = typeof r.inventory === 'string' ? JSON.parse(r.inventory) : (r.inventory ?? {});
  } catch {
    console.warn(`跳过（inventory 解析失败）: ${r.openid}`);
    skipped += 1;
    continue;
  }
  const next = computePower(inv);
  if (next !== r.power) {
    const openid = String(r.openid).replace(/'/g, "''");
    lines.push(`UPDATE users SET power = ${next} WHERE openid = '${openid}';`);
    changed += 1;
  }
}
lines.push('COMMIT;');

fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, lines.join('\n') + '\n');

console.log(`扫描 ${rows.length} 行（跳过 ${skipped}），需更新 ${changed} 行 → ${outFile}`);
if (changed === 0) console.log('说明: 所有用户 power 已与新公式一致，无需执行 SQL。');
