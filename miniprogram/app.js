App({
  globalData: {
    useCloud: false,
    envId: "",
    version: "0.1.0-mvp"
  },
  onLaunch() {
    if (this.globalData.useCloud && wx.cloud) {
      wx.cloud.init({
        env: this.globalData.envId || undefined,
        traceUser: true
      });
    }
    const save = require("./utils/save");
    save.ensureNewPlayer();
  }
});
