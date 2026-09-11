const compete = require("../../services/compete-api");

Page({
  data: {
    opponentId: "",
    oppName: "对手",
    oppPower: 0,
    myPower: 0,
    result: null,
    fighting: false
  },
  onLoad(o) {
    const { save } = require("../../utils/save");
    this.setData({
      opponentId: decodeURIComponent(o.opponentId || ""),
      oppName: decodeURIComponent(o.oppName || "对手"),
      oppPower: parseInt(o.oppPower || "0", 10),
      myPower: (save.getSave().meta.power || 0)
    });
  },
  async doBattle() {
    if (this.data.fighting) return;
    this.setData({ fighting: true, result: null });
    try {
      const res = await compete.pk({ opponentId: this.data.opponentId });
      this.setData({ result: res });
    } catch (e) {
      wx.showToast({ title: e.message || "对战失败", icon: "none" });
    } finally {
      this.setData({ fighting: false });
    }
  },
  back() {
    wx.navigateBack();
  }
});
