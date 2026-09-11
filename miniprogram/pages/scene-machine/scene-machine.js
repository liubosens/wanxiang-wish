const save = require("../../utils/save");
const drawApi = require("../../services/draw-api");
const exchangeApi = require("../../services/exchange-api");
const { getPool } = require("../../utils/pools");

Page({
  data: {
    poolId: "c2_wangzhe_v1",
    wallet: {},
    spinning: false,
    result: null,
    exchange: { name: "", cost: 0, canExchange: false, owned: false }
  },
  onShow() {
    const wallet = save.getSave().wallet;
    const pool = getPool(this.data.poolId);
    const ex = (pool && pool.exchange) || null;
    const inv = save.getSave().inventory;
    this.setData({
      wallet,
      exchange: {
        name: ex ? ex.name : "",
        cost: ex ? ex.cost : 0,
        canExchange: !!ex && (wallet.point_wz || 0) >= (ex ? ex.cost : 0),
        owned: !!(ex && inv[ex.itemId])
      }
    });
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
      this.refreshExchange(res.wallet);
    } catch (e) {
      wx.showToast({ title: e.message || "失败", icon: "none" });
    } finally {
      this.setData({ spinning: false });
    }
  },
  refreshExchange(wallet) {
    const ex = this.data.exchange;
    if (!ex || !ex.cost) return;
    this.setData({
      exchange: {
        ...ex,
        canExchange: (wallet.point_wz || 0) >= ex.cost,
        owned: this.data.exchange.owned
      }
    });
  },
  async doExchange() {
    try {
      const res = await exchangeApi.exchange({ poolId: this.data.poolId });
      this.setData({ wallet: res.wallet, exchange: { ...this.data.exchange, canExchange: false, owned: true } });
      wx.showToast({ title: `已兑换 ${res.item.name}`, icon: "none" });
      this.onShow();
    } catch (e) {
      wx.showToast({ title: e.message || "兑换失败", icon: "none" });
    }
  },
  openRates() {
    wx.navigateTo({ url: `/pages/rates/rates?poolId=${this.data.poolId}` });
  }
});
