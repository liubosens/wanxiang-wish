const compete = require("../../services/compete-api");

Page({
  data: { rows: [], me: { rank: 0, power: 0 }, loading: true },
  onShow() {
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const res = await compete.leaderboard();
      this.setData({ rows: res.rows, me: res.me });
    } catch (e) {
      wx.showToast({ title: e.message || "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },
  challengeNext() {
    const { rows, me } = this.data;
    if (me.rank <= 1) return;
    const opp = rows.find((r) => r.rank === me.rank - 1) || rows[rows.length - 1];
    if (!opp) return;
    wx.navigateTo({
      url: `/pages/pk/pk?opponentId=${encodeURIComponent(opp.id)}&oppName=${encodeURIComponent(opp.name)}&oppPower=${opp.power}`
    });
  }
});
