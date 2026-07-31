const pools = {
  a1_standard_v1: require("../configs/pools/a1_standard_v1.json"),
  b1_copper_v1: require("../configs/pools/b1_copper_v1.json"),
  b1_silver_v1: require("../configs/pools/b1_silver_v1.json"),
  b1_gold_v1: require("../configs/pools/b1_gold_v1.json"),
  c2_roulette_v1: require("../configs/pools/c2_roulette_v1.json")
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

module.exports = { getPool, listPools, pools };
