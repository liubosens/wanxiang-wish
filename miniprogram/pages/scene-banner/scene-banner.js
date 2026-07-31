const { getPool } = require("../../utils/pools");
const save = require("../../utils/save");
const drawApi = require("../../services/draw-api");

Page({
  data: {
    poolId: "a1_standard_v1",
    pool: null,
    wallet: {},
    pityText: "",
    results: [],
    drawing: false
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const pool = getPool(this.data.poolId);
    const data = save.getSave();
    const pity = data.pity[this.data.poolId] || {};
    const ssr = pity.hard_ssr || 0;
    const sr = pity.hard_sr || 0;
    this.setData({
      pool,
      wallet: data.wallet,
      pityText: `距 SSR 硬保底 ${90 - ssr} 抽 · 距 SR 硬保底 ${10 - sr} 抽`,
      results: []
    });
  },
  async drawOne() {
    return this.runDraw(1);
  },
  async drawTen() {
    return this.runDraw(10);
  },
  async runDraw(times) {
    if (this.data.drawing) return;
    this.setData({ drawing: true });
    try {
      const res = await drawApi.draw({ poolId: this.data.poolId, times });
      this.setData({
        results: res.results,
        wallet: res.wallet,
        pityText: this.formatPity(res.pityState)
      });
    } catch (e) {
      wx.showToast({ title: e.message || "失败", icon: "none" });
    } finally {
      this.setData({ drawing: false });
    }
  },
  formatPity(pity) {
    const ssr = (pity && pity.hard_ssr) || 0;
    const sr = (pity && pity.hard_sr) || 0;
    return `距 SSR 硬保底 ${90 - ssr} 抽 · 距 SR 硬保底 ${10 - sr} 抽`;
  },
  openRates() {
    wx.navigateTo({ url: `/pages/rates/rates?poolId=${this.data.poolId}` });
  }
});
