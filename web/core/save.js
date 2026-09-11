// 本地存档。移植自 miniprogram/utils/save.js，存储后端换成 localStorage。
// 云端模式下，本存档同时充当服务端档案的本地快照（见 syncFromServer）。
import * as storage from './storage.js';
import { computePower } from './power.js';

export const KEY = 'wanxiang_save_v1';

const DEFAULT = {
  wallet: {
    dust: 0,
    wish_stone: 0,
    chest_key: 0,
    machine_coin: 0,
    point_wz: 0,
    fragments: 0, // 重复卡转化的升星碎片
    stone: 0, // 进阶石（≥3 星升星用）
  },
  inventory: {},
  codex: {},
  pity: {},
  serverPity: {},
  history: [],
  meta: {
    createdAt: 0,
    lastDailyAt: '',
    totalDraws: 0,
    power: 0,
    pkWin: 0,
    pkLose: 0,
    nickname: '',
  },
};

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function ensureNewPlayer() {
  let data = storage.read(KEY);
  if (!data) {
    data = clone(DEFAULT);
    data.meta.createdAt = Date.now();
    data.wallet.wish_stone = 60;
    data.wallet.chest_key = 15;
    data.wallet.machine_coin = 20;
    data.wallet.dust = 100;
    data.wallet.point_wz = 0;
    data.wallet.fragments = 0;
    data.wallet.stone = 3; // 原型期给少量进阶石，便于验证 ≥3 星升星链路
    storage.write(KEY, data);
  }
  // 老存档补齐新增字段，避免读到 undefined
  data.wallet = { ...clone(DEFAULT.wallet), ...(data.wallet || {}) };
  data.meta = { ...clone(DEFAULT.meta), ...(data.meta || {}) };
  return data;
}

export function getSave() {
  return ensureNewPlayer();
}

export function write(data) {
  storage.write(KEY, data);
  return data;
}

export function update(mutator) {
  const data = getSave();
  mutator(data);
  write(data);
  return data;
}

export function reset() {
  storage.remove(KEY);
  return ensureNewPlayer();
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

let dailyClaimedFlag;

export function claimDaily() {
  const data = update((s) => {
    const t = todayStr();
    if (s.meta.lastDailyAt === t) {
      dailyClaimedFlag = false;
      return;
    }
    s.wallet.wish_stone += 10;
    s.wallet.chest_key += 3;
    s.wallet.machine_coin += 5;
    s.wallet.dust += 30;
    s.wallet.stone += 1;
    s.meta.lastDailyAt = t;
    dailyClaimedFlag = true;
    s.meta.power = computePower(s.inventory);
  });
  data._dailyClaimed = dailyClaimedFlag;
  return data;
}

// 重新计算并缓存战力（抽卡/升星/兑换后调用）
export function recalcPower() {
  const data = getSave();
  data.meta.power = computePower(data.inventory);
  write(data);
  return data.meta.power;
}

// 用服务端档案覆盖本地快照。服务端权威模式下本地只是展示缓存。
export function syncFromServer(user) {
  return update((s) => {
    s.wallet = { ...clone(DEFAULT.wallet), ...(user.wallet || {}) };
    s.inventory = user.inventory || {};
    s.codex = user.codex || {};
    s.pity = user.pity || {};
    s.meta.power = user.power || 0;
    if (user.nick_name) s.meta.nickname = user.nick_name;
  });
}

export function exportSave() {
  return clone(getSave());
}

export function importSave(data) {
  const next = { ...clone(DEFAULT), ...(data || {}) };
  write(next);
  return getSave();
}
