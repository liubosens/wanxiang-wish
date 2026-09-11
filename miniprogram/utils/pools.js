const pools = {
  a1_standard_v1: require("../configs/pools/a1_standard_v1.json"),
  b1_copper_v1: require("../configs/pools/b1_copper_v1.json"),
  b1_silver_v1: require("../configs/pools/b1_silver_v1.json"),
  b1_gold_v1: require("../configs/pools/b1_gold_v1.json"),
  c2_roulette_v1: require("../configs/pools/c2_roulette_v1.json"),
  a1_genshin_v1: require("../configs/pools/a1_genshin_v1.json"),
  b1_sangokushi_v1: require("../configs/pools/b1_sangokushi_v1.json"),
  c2_wangzhe_v1: require("../configs/pools/c2_wangzhe_v1.json")
};

function getPool(poolId) {
  if (!pools[poolId]) return null;
  return JSON.parse(JSON.stringify(pools[poolId]));
}

function listPools() {
  return Object.keys(pools).map((id) => {
    const p = pools[id];
    return {
      poolId: id,
      name: p.name,
      sceneType: p.sceneType,
      cost: p.cost
    };
  });
}

// 全池去重卡牌总数（用于图鉴完成度口径）
function totalCards() {
  const ids = new Set();
  Object.keys(pools).forEach((id) => {
    const tables = pools[id].lootTables || {};
    Object.keys(tables).forEach((r) => {
      (tables[r] || []).forEach((t) => ids.add(t.itemId));
    });
  });
  return ids.size;
}

module.exports = { getPool, listPools, totalCards, pools };
