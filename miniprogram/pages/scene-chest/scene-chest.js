const save = require("../../utils/save");
const drawApi = require("../../services/draw-api");

Page({
  data: {
    wallet: {},
    chests: [
      { poolId: "b1_sangokushi_v1", name: "三国杀·全服博弈", cost: 1 }
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
