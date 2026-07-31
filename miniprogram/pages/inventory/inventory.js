const save = require("../../utils/save");

Page({
  data: { items: [], codexCount: 0 },
  onShow() {
    const data = save.getSave();
    const items = Object.keys(data.inventory).map((id) => ({
      itemId: id,
      ...data.inventory[id]
    })).sort((a, b) => {
      const rank = { SSR: 0, SR: 1, R: 2 };
      return (rank[a.rarity] || 9) - (rank[b.rarity] || 9);
    });
    this.setData({
      items,
      codexCount: Object.keys(data.codex || {}).length
    });
  }
});
