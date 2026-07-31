const save = require("../../utils/save");
const drawApi = require("../../services/draw-api");

Page({
  data: {
    wallet: {},
    chests: [
      { poolId: "b1_copper_v1", name: "铜宝箱", cost: 1 },
      { poolId: "b1_silver_v1", name: "银宝箱", cost: 3 },
      { poolId: "b1_gold_v1", name: "金宝箱", cost: 10 }
    ],
    results: [],
    drawing: false
  },
  onShow() {
    this.setData({ wallet: save.getSave().wallet });
  },
  async openChest(e) {
    if (this.data.drawing) return;
    const poolId = e.currentTarget.dataset.poolId;
    this.setData({ drawing: true });
    try {
      const res = await drawApi.draw({ poolId, times: 1 });
      this.setData({ results: res.results, wallet: res.wallet });
    } catch (err) {
      wx.showToast({ title: err.message || "失败", icon: "none" });
    } finally {
      this.setData({ drawing: false });
    }
  },
  openRates(e) {
    wx.navigateTo({ url: `/pages/rates/rates?poolId=${e.currentTarget.dataset.poolId}` });
  }
});
