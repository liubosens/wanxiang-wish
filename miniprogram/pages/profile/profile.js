const save = require("../../utils/save");

Page({
  data: {
    wallet: {},
    meta: {},
    version: "0.1.0-mvp"
  },
  onShow() {
    const app = getApp();
    const data = save.getSave();
    this.setData({
      wallet: data.wallet,
      meta: data.meta,
      version: app.globalData.version
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
  }
});
