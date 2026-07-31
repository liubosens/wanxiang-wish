const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { limit = 50 } = event || {};
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const res = await db
    .collection("history")
    .where({ openid })
    .orderBy("at", "desc")
    .limit(Math.min(limit, 100))
    .get();
  return { ok: true, data: res.data };
};
