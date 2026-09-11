const save = require("../utils/save");
const { getPool } = require("../utils/pools");
const power = require("../utils/power");

async function exchangeLocal({ poolId }) {
  const pool = getPool(poolId);
  if (!pool) throw new Error("卡池不存在");
  if (!pool.exchange || !pool.exchange.itemId) throw new Error("该卡池不支持兑换");

  const ex = pool.exchange;
  const cost = ex.cost || 0;
  const data = save.getSave();
  if ((data.wallet.point_wz || 0) < cost) {
    const err = new Error("荣耀积分不足");
    err.code = "INSUFFICIENT";
    throw err;
  }

  save.update((s) => {
    s.wallet.point_wz -= cost;
    const itemId = ex.itemId;
    const inv = s.inventory[itemId] || { count: 0, name: ex.name, rarity: "UR", star: 0 };
    const first = inv.count === 0;
    inv.count += 1;
    inv.name = ex.name;
    inv.rarity = "UR";
    inv.star = inv.star || 0;
    s.inventory[itemId] = inv;
    if (first) s.codex[itemId] = { name: ex.name, rarity: "UR", at: Date.now() };
    s.meta.power = power.computePower(s.inventory);
  });

  const after = save.getSave();
  return {
    item: { itemId: ex.itemId, name: ex.name, rarity: "UR" },
    wallet: after.wallet,
    power: after.meta.power
  };
}

async function exchange({ poolId }) {
  const app = getApp();
  if (app.globalData.useCloud && wx.cloud) {
    const res = await wx.cloud.callFunction({ name: "exchange", data: { poolId } });
    if (res.result && res.result.ok) return res.result.data;
    throw new Error((res.result && res.result.message) || "云函数兑换失败");
  }
  return exchangeLocal({ poolId });
}

module.exports = { exchange, exchangeLocal };
