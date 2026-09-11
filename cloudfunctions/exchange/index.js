const cloud = require("wx-server-sdk");
const power = require("./power");
const fs = require("fs");
const path = require("path");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function loadPool(poolId) {
  const file = path.join(__dirname, "pools", `${poolId}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

exports.main = async (event) => {
  const { poolId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!poolId) return { ok: false, message: "参数错误" };
  const pool = loadPool(poolId);
  if (!pool) return { ok: false, message: "卡池不存在" };
  if (!pool.exchange || !pool.exchange.itemId) {
    return { ok: false, message: "该卡池不支持兑换" };
  }

  const ex = pool.exchange;
  const cost = ex.cost || 0;

  const userRes = await db.collection("users").where({ openid }).limit(1).get();
  let user = userRes.data[0];
  if (!user) return { ok: false, message: "用户未初始化，请先抽一次卡" };
  if ((user.wallet.point_wz || 0) < cost) {
    return { ok: false, message: "荣耀积分不足" };
  }

  user.wallet.point_wz -= cost;
  const itemId = ex.itemId;
  const inv = user.inventory[itemId] || { count: 0, name: ex.name, rarity: "UR", star: 0 };
  const first = inv.count === 0;
  inv.count += 1;
  inv.name = ex.name;
  inv.rarity = "UR";
  inv.star = inv.star || 0;
  user.inventory[itemId] = inv;
  if (first) user.codex[itemId] = { name: ex.name, rarity: "UR", at: Date.now() };

  const newPower = power.computePower(user.inventory);
  await db.collection("users").doc(user._id).update({
    data: {
      wallet: user.wallet,
      inventory: user.inventory,
      codex: user.codex,
      power: newPower,
      updatedAt: Date.now()
    }
  });

  return {
    ok: true,
    data: {
      item: { itemId, name: ex.name, rarity: "UR" },
      wallet: user.wallet,
      power: newPower
    }
  };
};
