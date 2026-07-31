const save = require("../../utils/save");

Page({
  data: { list: [] },
  onShow() {
    const list = save.getSave().history || [];
    this.setData({ list });
  }
});
