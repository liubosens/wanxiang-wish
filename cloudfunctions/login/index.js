const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const found = await db.collection("users").where({ openid }).limit(1).get();
  if (found.data[0]) {
    return { ok: true, data: { openid, user: found.data[0] } };
  }
  const init = {
    openid,
    wallet: { dust: 100, wish_stone: 60, chest_key: 15, machine_coin: 20 },
    inventory: {},
    codex: {},
    pity: {},
    createdAt: Date.now()
  };
  await db.collection("users").add({ data: init });
  return { ok: true, data: { openid, user: init } };
};
