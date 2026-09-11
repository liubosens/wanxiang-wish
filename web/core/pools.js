// 卡池读取。数据源为构建期生成的 pools-data.js（源自 miniprogram/configs/pools/*.json）。
import { POOLS } from './pools-data.js';

export function getPool(poolId) {
  const p = POOLS[poolId];
  return p ? JSON.parse(JSON.stringify(p)) : null;
}

export function listPools() {
  return Object.keys(POOLS).map((id) => ({
    poolId: id,
    name: POOLS[id].name,
    sceneType: POOLS[id].sceneType,
    cost: POOLS[id].cost,
  }));
}

// 全池去重卡牌总数（用于图鉴完成度口径）
export function totalCards() {
  const ids = new Set();
  Object.keys(POOLS).forEach((id) => {
    const tables = POOLS[id].lootTables || {};
    Object.keys(tables).forEach((r) => {
      (tables[r] || []).forEach((t) => {
        // 货币扇区不算图鉴卡
        if (!CURRENCY_IDS.has(t.itemId)) ids.add(t.itemId);
      });
    });
    (POOLS[id].sectors || []).forEach((s) => {
      if (s.itemId && !CURRENCY_IDS.has(s.itemId)) ids.add(s.itemId);
    });
  });
  return ids.size;
}

export const CURRENCY_IDS = new Set(['wish_stone', 'chest_key', 'machine_coin', 'dust']);

export { POOLS };
