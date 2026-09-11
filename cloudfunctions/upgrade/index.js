const cloud = require("wx-server-sdk");
const power = require("./power");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { itemId } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!itemId) return { ok: false, message: "参数错误" };

  const userRes = await db.collection("users").where({ openid }).limit(1).get();
  let user = userRes.data[0];
  if (!user) return { ok: false, message: "用户未初始化" };

  const inv = user.inventory[itemId];
  if (!inv) return { ok: false, message: "尚未拥有该卡" };
  const star = inv.star || 0;
  if (star >= 5) return { ok: false, message: "已满星" };

  const cost = power.upgradeCost(inv.rarity, star);
  if ((user.wallet.fragments || 0) < cost.fragments) return { ok: false, message: "升星碎片不足" };
  if ((user.wallet.stone || 0) < cost.stone) return { ok: false, message: "进阶石不足" };

  user.wallet.fragments -= cost.fragments;
  user.wallet.stone -= cost.stone;
  inv.star = cost.nextStar;
  user.inventory[itemId] = inv;

  const newPower = power.computePower(user.inventory);
  await db.collection("users").doc(user._id).update({
    data: {
      wallet: user.wallet,
      inventory: user.inventory,
      power: newPower,
      updatedAt: Date.now()
    }
  });

  return {
    ok: true,
    data: {
      item: { itemId, name: inv.name, rarity: inv.rarity, star: inv.star },
      wallet: user.wallet,
      power: newPower
    }
  };
};
