// 卡池配置聚合。移植自 cloudfunctions/draw/pools/*.json。
// Workers 生产运行时无 fs，故以静态 import 组装为 Map（esbuild 在构建期内联 JSON）。

import genshin from './pools/a1_genshin_v1.json';
import standard from './pools/a1_standard_v1.json';
import copper from './pools/b1_copper_v1.json';
import gold from './pools/b1_gold_v1.json';
import sangokushi from './pools/b1_sangokushi_v1.json';
import silver from './pools/b1_silver_v1.json';
import roulette from './pools/c2_roulette_v1.json';
import wangzhe from './pools/c2_wangzhe_v1.json';
import type { Pool } from './roll-engine';

const all = [
  genshin,
  standard,
  copper,
  gold,
  sangokushi,
  silver,
  roulette,
  wangzhe,
] as unknown as Pool[];

const byId = new Map<string, Pool>(all.map((p) => [p.poolId, p]));

export function getPool(poolId: string): Pool | undefined {
  return byId.get(poolId);
}

export interface PoolSummary {
  poolId: string;
  name: string;
  sceneType?: string;
  cost: { itemId: string; amount: number };
}

export function listPools(): PoolSummary[] {
  return all.map((p) => ({
    poolId: p.poolId,
    name: p.name,
    sceneType: p.sceneType,
    cost: p.cost,
  }));
}
