const { getPool, listPools } = require("../../utils/pools");

Page({
  data: {
    poolId: "",
    pool: null,
    poolOptions: []
  },
  onLoad(query) {
    const options = listPools();
    const poolId = query.poolId || options[0].poolId;
    this.setData({
      poolOptions: options,
      poolId,
      pool: getPool(poolId)
    });
  },
  onPick(e) {
    const poolId = this.data.poolOptions[e.detail.value].poolId;
    this.setData({ poolId, pool: getPool(poolId) });
  }
});
