const save = require("../../utils/save");
const upgradeApi = require("../../services/upgrade-api");

Page({
  data: { items: [], codexCount: 0, power: 0, wallet: {} },
  onShow() {
    this.refresh();
  },
  refresh() {
    const data = save.getSave();
    const rank = { UR: 0, SR: 1, R: 2 };
    const items = Object.keys(data.inventory)
      .map((id) => ({ itemId: id, ...data.inventory[id] }))
      .sort((a, b) => (rank[a.rarity] || 9) - (rank[b.rarity] || 9));

    // 附带升星预览与可升星判定
    items.forEach((it) => {
      const cost = upgradeApi.previewCost(it.itemId);
      it.star = it.star || 0;
      it.canUpgrade = !!(cost && !cost.max);
      it.nextCostText = cost && !cost.max
        ? `升★${cost.nextStar}：碎片${cost.fragments}${cost.stone ? " · 进阶石" + cost.stone : ""}`
        : "已满星";
    });

    this.setData({
      items,
      codexCount: Object.keys(data.codex || {}).length,
      power: data.meta.power || 0,
      wallet: data.wallet
    });
  },
  async tapUpgrade(e) {
    const itemId = e.currentTarget.dataset.id;
    try {
      const res = await upgradeApi.upgrade({ itemId });
      wx.showToast({ title: `升至 ★${res.item.star}`, icon: "none" });
      this.refresh();
    } catch (err) {
      wx.showToast({ title: err.message || "升星失败", icon: "none" });
    }
  }
});
