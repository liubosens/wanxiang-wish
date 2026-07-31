const KEY = "wanxiang_save_v1";

const DEFAULT = {
  wallet: {
    dust: 0,
    wish_stone: 0,
    chest_key: 0,
    machine_coin: 0
  },
  inventory: {},
  codex: {},
  pity: {},
  history: [],
  meta: {
    createdAt: 0,
    lastDailyAt: "",
    totalDraws: 0
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
    data.meta.lastDailyAt = t;
    data._dailyClaimed = true;
  });
}

module.exports = {
  KEY,
  getSave,
  update,
  claimDaily,
  ensureNewPlayer,
  todayStr
};
