const cloud = require("wx-server-sdk");
const { roll } = require("./roll-engine");
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
  const { poolId, times = 1, clientToken } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!poolId || times < 1 || times > 10) {
    return { ok: false, message: "参数错误" };
  }

  const pool = loadPool(poolId);
  if (!pool) return { ok: false, message: "卡池不存在" };

  // 简单防重放：同 token 直接拒绝（集合 tokens 需自行创建）
  if (clientToken) {
    try {
      await db.collection("draw_tokens").add({
        data: { _id: `${openid}_${clientToken}`, at: Date.now() }
      });
    } catch (e) {
      return { ok: false, message: "重复请求" };
    }
  }

  const userRes = await db.collection("users").where({ openid }).limit(1).get();
  let user = userRes.data[0];
  if (!user) {
    const init = {
      openid,
      wallet: { dust: 100, wish_stone: 60, chest_key: 15, machine_coin: 20 },
      inventory: {},
      codex: {},
      pity: {},
      createdAt: Date.now()
    };
    const addRes = await db.collection("users").add({ data: init });
    user = { _id: addRes._id, ...init };
  }

  const costItem = pool.cost.itemId;
  const need = (pool.cost.amount || 1) * times;
  if ((user.wallet[costItem] || 0) < need) {
    return { ok: false, message: "货币不足" };
  }

  const pityState = (user.pity && user.pity[poolId]) || {};
  const rolled = roll(pool, pityState, times, {});

  user.wallet[costItem] -= need;
  user.pity = user.pity || {};
  user.pity[poolId] = rolled.pityState;

  const historyRows = [];
  rolled.results.forEach((item) => {
    if (["wish_stone", "chest_key", "machine_coin", "dust"].includes(item.itemId)) {
      const add = item.itemId === "dust" ? 50 : item.itemId === "machine_coin" ? 2 : 1;
      user.wallet[item.itemId] = (user.wallet[item.itemId] || 0) + add;
    } else {
      const inv = user.inventory[item.itemId] || { count: 0, name: item.name, rarity: item.rarity };
      const first = inv.count === 0;
      inv.count += 1;
      inv.name = item.name;
      inv.rarity = item.rarity;
      user.inventory[item.itemId] = inv;
      if (first) {
        user.codex[item.itemId] = { name: item.name, rarity: item.rarity, at: Date.now() };
      }
    }
    historyRows.push({
      openid,
      poolId,
      poolName: pool.name,
      itemId: item.itemId,
      name: item.name,
      rarity: item.rarity,
      at: Date.now()
    });
  });

  await db.collection("users").doc(user._id).update({
    data: {
      wallet: user.wallet,
      inventory: user.inventory,
      codex: user.codex,
      pity: user.pity,
      updatedAt: Date.now()
    }
  });

  if (historyRows.length) {
    const batch = historyRows.map((row) => db.collection("history").add({ data: row }));
    await Promise.all(batch);
  }

  return {
    ok: true,
    data: {
      results: rolled.results,
      pityState: rolled.pityState,
      wallet: user.wallet
    }
  };
};
