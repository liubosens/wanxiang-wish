const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  const meRes = await db.collection("users").where({ openid }).limit(1).get();
  const me = meRes.data[0];
  if (!me) return { ok: false, message: "用户未初始化" };
  const myPower = me.power || 0;

  // 排名：战力不低于我的人数 +1
  const aboveRes = await db.collection("users").where("power", ">=", myPower).count();
  const myRank = (aboveRes.total || 0) + 1;

  // 前 50 名快照
  const topRes = await db
    .collection("users")
    .orderBy("power", "desc")
    .limit(50)
    .get();
  const rows = topRes.data.map((u, idx) => ({
    rank: idx + 1,
    id: u.openid,
    name: u.nickName || "玩家",
    power: u.power || 0,
    isMe: u.openid === openid
  }));

  return {
    ok: true,
    data: {
      me: { rank: myRank, power: myPower },
      rows
    }
  };
};
