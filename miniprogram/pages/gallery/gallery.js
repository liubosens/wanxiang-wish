Page({
  data: {
    wallet: {},
    scenes: [
      {
        id: "banner",
        title: "标准祈愿",
        desc: "A1 卡池 · A3 软硬保底",
        url: "/pages/scene-banner/scene-banner"
      },
      {
        id: "chest",
        title: "分级宝箱",
        desc: "B1 铜 / 银 / 金箱",
        url: "/pages/scene-chest/scene-chest"
      },
      {
        id: "machine",
        title: "星轨转盘",
        desc: "C2 权重扇区",
        url: "/pages/scene-machine/scene-machine"
      }
    ]
  },
  onShow() {
    const save = require("../../utils/save");
    this.setData({ wallet: save.getSave().wallet });
  },
  go(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  },
  goRates() {
    wx.navigateTo({ url: "/pages/rates/rates?poolId=a1_standard_v1" });
  }
});
