const save = require("../utils/save");
const power = require("../utils/power");

// 计算升星到下一级的成本（供 UI 展示与本地校验）
function previewCost(itemId) {
  const data = save.getSave();
  const inv = data.inventory[itemId];
  if (!inv) return null;
  const star = inv.star || 0;
  if (star >= 5) return { max: true, star };
  const cost = power.upgradeCost(inv.rarity, star);
  return { star, nextStar: cost.nextStar, fragments: cost.fragments, stone: cost.stone, rarity: inv.rarity };
}

async function upgradeLocal({ itemId }) {
  const data = save.getSave();
  const inv = data.inventory[itemId];
  if (!inv) {
    const err = new Error("尚未拥有该卡");
    err.code = "NO_OWN";
    throw err;
  }
  const star = inv.star || 0;
  if (star >= 5) {
    const err = new Error("已满星");
    err.code = "MAX";
    throw err;
  }
  const cost = power.upgradeCost(inv.rarity, star);
  if ((data.wallet.fragments || 0) < cost.fragments) {
    const err = new Error("升星碎片不足");
    err.code = "INSUFFICIENT_FRAG";
    throw err;
  }
  if ((data.wallet.stone || 0) < cost.stone) {
    const err = new Error("进阶石不足");
    err.code = "INSUFFICIENT_STONE";
    throw err;
  }

  save.update((s) => {
    s.wallet.fragments -= cost.fragments;
    s.wallet.stone -= cost.stone;
    const it = s.inventory[itemId];
    it.star = cost.nextStar;
    s.meta.power = power.computePower(s.inventory);
  });

  const after = save.getSave();
  return {
    item: { itemId, name: inv.name, rarity: inv.rarity, star: after.inventory[itemId].star },
    wallet: after.wallet,
    power: after.meta.power
  };
}

async function upgrade({ itemId }) {
  const app = getApp();
  if (app.globalData.useCloud && wx.cloud) {
    const res = await wx.cloud.callFunction({ name: "upgrade", data: { itemId } });
    if (res.result && res.result.ok) return res.result.data;
    throw new Error((res.result && res.result.message) || "云函数升星失败");
  }
  return upgradeLocal({ itemId });
}

module.exports = { upgrade, upgradeLocal, previewCost };
