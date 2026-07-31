const save = require("../utils/save");
const { getPool } = require("../utils/pools");
const { roll } = require("../lib/roll-engine");

function currencyLabel(id) {
  const map = {
    wish_stone: "祈愿石",
    chest_key: "箱钥",
    machine_coin: "机台币",
    dust: "星尘币"
  };
  return map[id] || id;
}

async function drawLocal({ poolId, times }) {
  const pool = getPool(poolId);
  if (!pool) throw new Error("卡池不存在");

  const costItem = pool.cost.itemId;
  const unit = pool.cost.amount || 1;
  const need = unit * times;
  const data = save.getSave();
  if ((data.wallet[costItem] || 0) < need) {
    const err = new Error(`${currencyLabel(costItem)}不足`);
    err.code = "INSUFFICIENT";
    throw err;
  }

  const pityKey = poolId;
  const pityState = data.pity[pityKey] || {};
  const rolled = roll(pool, pityState, times, {});

  save.update((s) => {
    s.wallet[costItem] -= need;
    s.pity[pityKey] = rolled.pityState;
    s.meta.totalDraws += times;
    rolled.results.forEach((item) => {
      // 货币扇区直接入钱包
      if (["wish_stone", "chest_key", "machine_coin", "dust"].includes(item.itemId)) {
        const add = item.itemId === "dust" ? 50 : item.itemId === "machine_coin" ? 2 : 1;
        s.wallet[item.itemId] = (s.wallet[item.itemId] || 0) + add;
      } else {
        const inv = s.inventory[item.itemId] || { count: 0, name: item.name, rarity: item.rarity };
        const first = inv.count === 0;
        inv.count += 1;
        inv.name = item.name;
        inv.rarity = item.rarity;
        s.inventory[item.itemId] = inv;
        if (first) s.codex[item.itemId] = { name: item.name, rarity: item.rarity, at: Date.now() };
      }
      s.history.unshift({
        id: `${Date.now()}_${item.index}_${Math.random().toString(16).slice(2, 6)}`,
        poolId,
        poolName: pool.name,
        itemId: item.itemId,
        name: item.name,
        rarity: item.rarity,
        at: Date.now()
      });
    });
    s.history = s.history.slice(0, 200);
  });

  return {
    results: rolled.results,
    pityState: rolled.pityState,
    wallet: save.getSave().wallet
  };
}

async function draw({ poolId, times }) {
  const app = getApp();
  if (app.globalData.useCloud && wx.cloud) {
    const res = await wx.cloud.callFunction({
      name: "draw",
      data: { poolId, times, clientToken: `${Date.now()}_${Math.random()}` }
    });
    if (res.result && res.result.ok) return res.result.data;
    throw new Error((res.result && res.result.message) || "云函数抽卡失败");
  }
  return drawLocal({ poolId, times });
}

module.exports = {
  draw,
  drawLocal,
  currencyLabel
};
