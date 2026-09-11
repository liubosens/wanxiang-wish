const save = require("../utils/save");
const { getPool } = require("../utils/pools");
const { roll } = require("../lib/roll-engine");
const power = require("../utils/power");

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
  let forceRarity = null;
  let spCount = (data.serverPity && data.serverPity[poolId]) || 0;
  if (pool.serverPity && pool.serverPity.enabled) {
    spCount = spCount + 1 + Math.floor(Math.random() * 3);
    if (spCount >= pool.serverPity.threshold) { forceRarity = pool.serverPity.rewardRarity; spCount = 0; }
  }
  const rolled = roll(pool, pityState, times, forceRarity ? { forceRarity } : {});

  save.update((s) => {
    s.wallet[costItem] -= need;
    if (poolId === "c2_wangzhe_v1") s.wallet.point_wz = (s.wallet.point_wz || 0) + times;
    if (pool.serverPity && pool.serverPity.enabled) { s.serverPity = s.serverPity || {}; s.serverPity[poolId] = spCount; }
    s.pity[pityKey] = rolled.pityState;
    s.meta.totalDraws += times;
    rolled.results.forEach((item) => {
      // 货币扇区直接入钱包
      if (["wish_stone", "chest_key", "machine_coin", "dust"].includes(item.itemId)) {
        const add = item.itemId === "dust" ? 50 : item.itemId === "machine_coin" ? 2 : 1;
        s.wallet[item.itemId] = (s.wallet[item.itemId] || 0) + add;
      } else {
        const inv = s.inventory[item.itemId] || { count: 0, name: item.name, rarity: item.rarity, star: 0 };
        const first = inv.count === 0;
        inv.count += 1;
        inv.star = inv.star || 0;
        inv.name = item.name;
        inv.rarity = item.rarity;
        s.inventory[item.itemId] = inv;
        if (first) {
          s.codex[item.itemId] = { name: item.name, rarity: item.rarity, at: Date.now() };
        } else {
          // 重复卡转化为升星碎片（卡牌必须有用）
          const gain = power.dupFragmentGain(inv.rarity);
          s.wallet.fragments = (s.wallet.fragments || 0) + gain;
        }
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
    s.meta.power = power.computePower(s.inventory); // 抽卡后重算战力
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
