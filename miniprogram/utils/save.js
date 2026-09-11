const KEY = "wanxiang_save_v1";
const power = require("./power");

const DEFAULT = {
  wallet: {
    dust: 0,
    wish_stone: 0,
    chest_key: 0,
    machine_coin: 0,
    point_wz: 0,
    fragments: 0, // 重复卡转化的升星碎片
    stone: 0      // 进阶石（≥3 星升星用）
  },
  inventory: {},
  codex: {},
  pity: {},
  serverPity: {},
  history: [],
  meta: {
    createdAt: 0,
    lastDailyAt: "",
    totalDraws: 0,
    power: 0,   // 战力缓存
    pkWin: 0,
    pkLose: 0
  }
};

function read() {
  try {
    const raw = wx.getStorageSync(KEY);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    return null;
  }
}

function write(data) {
  wx.setStorageSync(KEY, data);
}

function ensureNewPlayer() {
  let data = read();
  if (!data) {
    data = JSON.parse(JSON.stringify(DEFAULT));
    data.meta.createdAt = Date.now();
    data.wallet.wish_stone = 60;
    data.wallet.chest_key = 15;
    data.wallet.machine_coin = 20;
    data.wallet.dust = 100;
    data.wallet.point_wz = 0;
    data.wallet.fragments = 0;
    data.wallet.stone = 3; // 原型期给少量进阶石，便于验证 ≥3 星升星链路
    write(data);
  }
  return data;
}

function getSave() {
  return ensureNewPlayer();
}

function update(mutator) {
  const data = getSave();
  mutator(data);
  write(data);
  return data;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function claimDaily() {
  return update((data) => {
    const t = todayStr();
    if (data.meta.lastDailyAt === t) {
      data._dailyClaimed = false;
      return;
    }
    data.wallet.wish_stone += 10;
    data.wallet.chest_key += 3;
    data.wallet.machine_coin += 5;
    data.wallet.dust += 30;
    data.wallet.stone += 1; // 进阶石日常小额发放，缓解 ≥3 星升星卡点
    data.meta.lastDailyAt = t;
    data._dailyClaimed = true;
    data.meta.power = power.computePower(data.inventory);
  });
}

// 重新计算并缓存战力（抽卡/升星/兑换后调用）
function recalcPower() {
  const data = getSave();
  data.meta.power = power.computePower(data.inventory);
  write(data);
  return data.meta.power;
}

module.exports = {
  KEY,
  getSave,
  update,
  claimDaily,
  recalcPower,
  ensureNewPlayer,
  todayStr
};
