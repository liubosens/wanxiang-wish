// 把 miniprogram/configs/pools/*.json 打包成 ES module，供浏览器直接 import。
// 浏览器 import JSON 需要 import assertions（兼容性不佳），故在构建期转成 .js。
// 用法：node web/tools/build-pools.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const srcDir = path.join(root, 'miniprogram', 'configs', 'pools');
const outFile = path.join(root, 'web', 'core', 'pools-data.js');

const files = fs
  .readdirSync(srcDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

const entries = files.map((f) => {
  const id = path.basename(f, '.json');
  const raw = fs.readFileSync(path.join(srcDir, f), 'utf8').trim();
  return `  ${JSON.stringify(id)}: ${raw}`;
});

const out = `// 自动生成，请勿手改 —— 由 web/tools/build-pools.mjs 从
// miniprogram/configs/pools/*.json 生成。改卡池请改源 JSON 后重跑脚本。
export const POOLS = {
${entries.join(',\n')}
};

export default POOLS;
`;

fs.writeFileSync(outFile, out, 'utf8');
console.log(`已生成 ${path.relative(root, outFile)}（${files.length} 个卡池）`);
