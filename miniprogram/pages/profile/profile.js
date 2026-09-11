const save = require("../../utils/save");
const { totalCards } = require("../../utils/pools");

Page({
  data: {
    wallet: {},
    meta: {},
    version: "0.1.0-mvp",
    power: 0,
    codexPct: 0,
    codexOwned: 0,
    codexTotal: 0
  },
  onShow() {
    const app = getApp();
    const data = save.getSave();
    const total = totalCards();
    const owned = Object.keys(data.codex || {}).length;
    this.setData({
      wallet: data.wallet,
      meta: data.meta,
      version: app.globalData.version,
      power: data.meta.power || 0,
      codexOwned: owned,
      codexTotal: total,
      codexPct: total ? Math.round((owned / total) * 100) : 0
    });
  },
  claimDaily() {
    const data = save.claimDaily();
    if (data._dailyClaimed === false) {
      wx.showToast({ title: "今日已领取", icon: "none" });
    } else {
      wx.showToast({ title: "补给已到账" });
    }
    this.onShow();
  },
  resetSave() {
    wx.showModal({
      title: "重置存档",
      content: "将清空本地钱包、背包与记录，仅用于调试。",
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync(save.KEY);
        save.ensureNewPlayer();
        this.onShow();
        wx.showToast({ title: "已重置" });
      }
    });
  },
  openLeaderboard() {
    wx.switchTab({ url: "/pages/leaderboard/leaderboard" });
  }
});
