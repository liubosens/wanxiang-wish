const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { opponentId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!opponentId || opponentId === openid) return { ok: false, message: "对手无效" };

  const meRes = await db.collection("users").where({ openid }).limit(1).get();
  const oppRes = await db.collection("users").where({ openid: opponentId }).limit(1).get();
  const me = meRes.data[0];
  const opp = oppRes.data[0];
  if (!me || !opp) return { ok: false, message: "对战双方数据缺失" };

  const myPower = me.power || 0;
  const oppPower = opp.power || 0;
  const myVal = myPower * (0.85 + 0.3 * Math.random());
  const oppVal = oppPower * (0.85 + 0.3 * Math.random());
  const win = myVal >= oppVal;

  const patch = win
    ? {
        "wallet.wish_stone": db.command.inc(5),
        "wallet.stone": db.command.inc(1),
        pkWin: db.command.inc(1)
      }
    : { pkLose: db.command.inc(1) };

  await db.collection("users").doc(me._id).update({ data: patch });

  return {
    ok: true,
    data: {
      win,
      myVal: Math.round(myVal),
      oppVal: Math.round(oppVal),
      oppName: opp.nickName || "玩家",
      oppPower,
      // 排名只由 power 决定；PK 胜为负资源事件 + 战绩，不改动 power
    }
  };
};
