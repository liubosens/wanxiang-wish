const save = require("../../utils/save");
const drawApi = require("../../services/draw-api");

Page({
  data: {
    poolId: "c2_roulette_v1",
    wallet: {},
    spinning: false,
    result: null
  },
  onShow() {
    this.setData({ wallet: save.getSave().wallet });
  },
  async spin() {
    if (this.data.spinning) return;
    this.setData({ spinning: true, result: null });
    try {
      const res = await drawApi.draw({ poolId: this.data.poolId, times: 1 });
      this.setData({
        result: res.results[0],
        wallet: res.wallet
      });
    } catch (e) {
      wx.showToast({ title: e.message || "失败", icon: "none" });
    } finally {
      this.setData({ spinning: false });
    }
  },
  openRates() {
    wx.navigateTo({ url: `/pages/rates/rates?poolId=${this.data.poolId}` });
  }
});
