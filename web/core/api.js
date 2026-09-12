// 数据访问层。统一收口，调用方不关心数据来自服务端还是本机。
//
// 两种模式：
//  - 云端（isCloud() === true）：服务端权威。抽卡概率/保底/战力全部由 Worker 计算，
//    本地存档仅作展示缓存，由 refreshMe() 拉取同步。
//  - 本地（apiBase 未配置或 forceLocal）：本机 Mock 掷骰，数据只存 localStorage。
//
// 移植自 miniprogram/services/*.js —— 把 wx.cloud.callFunction 换成了 fetch。
import { CONFIG } from './config.js';
import * as storage from './storage.js';
import * as save from './save.js';
import { getPool } from './pools.js';
import { roll } from './roll-engine.js';
import { computePower, dupFragmentGain, upgradeCost } from './power.js';

const DEVICE_KEY = 'wanxiang_device_id';
const TOKEN_KEY = 'wanxiang_token';

export function isCloud() {
  return !CONFIG.forceLocal && !!CONFIG.apiBase;
}

export function modeLabel() {
  return isCloud() ? '云端' : '本地';
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDeviceId() {
  let id = storage.read(DEVICE_KEY);
  if (!id) {
    id = `dev_${randomId()}`;
    storage.write(DEVICE_KEY, id);
  }
  return id;
}

// 切换到指定账号（用账号 ID 恢复），清掉旧 token 以便下次 login 重新签发。
export function setDeviceId(id) {
  const clean = String(id || '').trim();
  if (!clean) return getDeviceId();
  storage.write(DEVICE_KEY, clean);
  storage.remove(TOKEN_KEY);
  return clean;
}

// 在本机生成一个全新账号（deviceId 换新），并退出当前登录态。
export function newDeviceId() {
  const id = `dev_${randomId()}`;
  storage.write(DEVICE_KEY, id);
  storage.remove(TOKEN_KEY);
  return id;
}

const CURRENCY_IDS = ['wish_stone', 'chest_key', 'machine_coin', 'dust'];
const CURRENCY_GAIN = { wish_stone: 1, chest_key: 1, machine_coin: 2, dust: 50 };

// ---------------------------------------------------------------- HTTP

let loginPromise = null;

async function request(path, options = {}, retry = true) {
  const headers = { 'Content-Type': 'application/json' };
  const token = storage.read(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(CONFIG.apiBase + path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // token 过期：静默重登一次再重放请求
  if (res.status === 401 && retry) {
    await login(true);
    return request(path, options, false);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `请求失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function login(force = false) {
  if (!isCloud()) return null;
  if (!force && storage.read(TOKEN_KEY)) return null;
  if (loginPromise) return loginPromise;

  loginPromise = (async () => {
    try {
      const data = await request(
        '/api/login',
        {
          method: 'POST',
          body: {
            deviceId: getDeviceId(),
            nickname: save.getSave().meta.nickname || undefined,
          },
        },
        false,
      );
      storage.write(TOKEN_KEY, data.token);
      save.syncFromServer(data.user);
      return data.user;
    } finally {
      loginPromise = null;
    }
  })();
  return loginPromise;
}

export function logout() {
  storage.remove(TOKEN_KEY);
}

// 拉取服务端完整档案（背包/图鉴/保底），覆盖本地快照。
export async function refreshMe() {
  if (!isCloud()) return save.getSave();
  const data = await request('/api/me');
  save.syncFromServer(data.user);
  return save.getSave();
}

// ---------------------------------------------------------------- 账号

// 修改昵称 / 头像。云端持久化并让排行榜立即生效；本地仅写入本机存档。
export async function updateProfile({ nickname, avatar } = {}) {
  if (!isCloud()) {
    save.update((s) => {
      if (typeof nickname === 'string') s.meta.nickname = nickname;
      if (typeof avatar === 'string') s.meta.avatar = avatar;
    });
    return save.getSave();
  }
  const data = await request('/api/profile', { method: 'POST', body: { nickname, avatar } });
  save.syncFromServer(data.user);
  return data.user;
}

// 每日签到。云端由服务端权威发放并记录自然日；本地走存档内的 claimDaily。
export async function claimDaily() {
  if (!isCloud()) {
    const data = save.claimDaily();
    return { claimed: data._dailyClaimed !== false, wallet: data.wallet, lastDailyAt: data.meta.lastDailyAt };
  }
  const data = await request('/api/daily', { method: 'POST' });
  save.update((s) => {
    if (data.wallet) s.wallet = { ...s.wallet, ...data.wallet };
    if (data.lastDailyAt) s.meta.lastDailyAt = data.lastDailyAt;
  });
  return data;
}

// 账号注销：清空服务端档案（不可逆）。
export async function deleteAccount() {
  if (!isCloud()) return { ok: true };
  await request('/api/account', { method: 'DELETE' });
  return { ok: true };
}

// ---------------------------------------------------------------- 任务/成就

// 任务/成就状态（服务端唯一真相源）。本地模式无任务系统，返回 null 由视图层提示。
export async function fetchQuests() {
  if (!isCloud()) return null;
  return request('/api/quests');
}

// 领取任务奖励（幂等，重复领取返回当前态）。
export async function claimQuest(questId) {
  if (!isCloud()) return null;
  const data = await request('/api/quests/claim', { method: 'POST', body: { questId } });
  if (data.wallet) {
    save.update((s) => {
      s.wallet = { ...s.wallet, ...data.wallet };
    });
  }
  return data;
}

// ---------------------------------------------------------------- 试炼塔

// 塔状态 + 下一层守将。本地模式返回 null。
export async function fetchTower() {
  if (!isCloud()) return null;
  return request('/api/tower');
}

// 挑战下一层（clientToken 幂等防弱网双扣次数）。
export async function challengeTower() {
  if (!isCloud()) return null;
  const data = await request('/api/tower/challenge', {
    method: 'POST',
    body: { clientToken: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` },
  });
  if (data.wallet) {
    save.update((s) => {
      s.wallet = { ...s.wallet, ...data.wallet };
    });
  }
  return data;
}

// 每日扫荡已通最高层 1 次。
export async function sweepTower() {
  if (!isCloud()) return null;
  const data = await request('/api/tower/sweep', { method: 'POST' });
  if (data.wallet) {
    save.update((s) => {
      s.wallet = { ...s.wallet, ...data.wallet };
    });
  }
  return data;
}

// ---------------------------------------------------------------- 限时活动

// 当前生效活动 + 未来 7 天预告（仅展示用；活动生效判定在服务端结算点内联）。
export async function fetchEvents() {
  if (!isCloud()) return null;
  return request('/api/events');
}

// ---------------------------------------------------------------- 抽卡

export async function draw({ poolId, times }) {
  if (!isCloud()) return drawLocal({ poolId, times });

  const data = await request('/api/draw', {
    method: 'POST',
    body: {
      poolId,
      times,
      clientToken: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    },
  });

  const pool = getPool(poolId);
  save.update((d) => {
    d.wallet = { ...d.wallet, ...data.wallet };
    d.meta.power = data.power;
    d.meta.totalDraws = (d.meta.totalDraws || 0) + times;
    d.pity[poolId] = data.pityState;
    data.results.forEach((r, idx) => {
      d.history.unshift({
        id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        poolId,
        poolName: pool ? pool.name : poolId,
        itemId: r.itemId,
        name: r.name,
        rarity: r.rarity,
        at: Date.now(),
      });
    });
    d.history = d.history.slice(0, 200);
  });
  return data;
}

function drawLocal({ poolId, times }) {
  return new Promise((resolve, reject) => {
    const pool = getPool(poolId);
    if (!pool) return reject(new Error('卡池不存在'));

    const costItem = pool.cost.itemId;
    const unit = pool.cost.amount || 1;
    const need = unit * times;
    const data = save.getSave();
    if ((data.wallet[costItem] || 0) < need) {
      return reject(new Error(`${currencyLabel(costItem)}不足`));
    }

    const pityKey = poolId;
    const pityState = data.pity[pityKey] || {};
    let forceRarity = null;
    let spCount = (data.serverPity && data.serverPity[poolId]) || 0;
    if (pool.serverPity && pool.serverPity.enabled) {
      spCount = spCount + 1 + Math.floor(Math.random() * 3);
      if (spCount >= pool.serverPity.threshold) {
        forceRarity = pool.serverPity.rewardRarity;
        spCount = 0;
      }
    }

    const rolled = roll(pool, pityState, times, forceRarity ? { forceRarity } : {});

    save.update((s) => {
      s.wallet[costItem] -= need;
      if (pool.pointsPerDraw) {
        s.wallet.point_wz = (s.wallet.point_wz || 0) + pool.pointsPerDraw * times;
      }
      if (pool.serverPity && pool.serverPity.enabled) {
        s.serverPity = s.serverPity || {};
        s.serverPity[poolId] = spCount;
      }
      s.pity[pityKey] = rolled.pityState;
      s.meta.totalDraws += times;

      rolled.results.forEach((item, idx) => {
        const gain = CURRENCY_GAIN[item.itemId];
        if (gain !== undefined) {
          s.wallet[item.itemId] = (s.wallet[item.itemId] || 0) + gain;
        } else {
          const inv = s.inventory[item.itemId] || {
            count: 0,
            name: item.name,
            rarity: item.rarity,
            star: 0,
          };
          const first = inv.count === 0;
          inv.count += 1;
          inv.star = inv.star || 0;
          inv.name = item.name;
          inv.rarity = item.rarity;
          s.inventory[item.itemId] = inv;
          if (first) {
            s.codex[item.itemId] = { name: item.name, rarity: item.rarity, at: Date.now() };
          } else {
            // 重复卡转化为升星碎片（卡牌必须有用）
            s.wallet.fragments = (s.wallet.fragments || 0) + dupFragmentGain(inv.rarity);
          }
        }
        s.history.unshift({
          id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          poolId,
          poolName: pool.name,
          itemId: item.itemId,
          name: item.name,
          rarity: item.rarity,
          at: Date.now(),
        });
      });
      s.history = s.history.slice(0, 200);
      s.meta.power = computePower(s.inventory);
    });

    const after = save.getSave();
    resolve({ results: rolled.results, pityState: rolled.pityState, wallet: after.wallet, power: after.meta.power });
  });
}

export function currencyLabel(id) {
  const map = {
    wish_stone: '祈愿石',
    chest_key: '箱钥',
    machine_coin: '机台币',
    dust: '星尘币',
    point_wz: '荣耀积分',
    fragments: '升星碎片',
    stone: '进阶石',
  };
  return map[id] || id;
}

// ---------------------------------------------------------------- 兑换

export async function exchange({ poolId }) {
  if (!isCloud()) return exchangeLocal({ poolId });

  const data = await request('/api/exchange', { method: 'POST', body: { poolId } });
  save.update((d) => {
    d.wallet = { ...d.wallet, ...data.wallet };
    d.meta.power = data.power;
  });
  await refreshMe();
  return data;
}

function exchangeLocal({ poolId }) {
  return new Promise((resolve, reject) => {
    const pool = getPool(poolId);
    if (!pool) return reject(new Error('卡池不存在'));
    const ex = pool.exchange;
    if (!ex || !ex.itemId) return reject(new Error('该卡池不支持兑换'));

    const cost = ex.cost || 0;
    const data = save.getSave();
    if ((data.wallet.point_wz || 0) < cost) return reject(new Error('荣耀积分不足'));

    save.update((s) => {
      s.wallet.point_wz -= cost;
      const inv = s.inventory[ex.itemId] || { count: 0, name: ex.name, rarity: 'UR', star: 0 };
      const first = inv.count === 0;
      inv.count += 1;
      inv.name = ex.name;
      inv.rarity = 'UR';
      inv.star = inv.star || 0;
      s.inventory[ex.itemId] = inv;
      if (first) s.codex[ex.itemId] = { name: ex.name, rarity: 'UR', at: Date.now() };
      s.meta.power = computePower(s.inventory);
    });

    const after = save.getSave();
    resolve({
      item: { itemId: ex.itemId, name: ex.name, rarity: 'UR' },
      wallet: after.wallet,
      power: after.meta.power,
    });
  });
}

// ---------------------------------------------------------------- 升星

// 升星成本预览（本地存档口径，供 UI 展示）
export function previewCost(itemId) {
  const data = save.getSave();
  const inv = data.inventory[itemId];
  if (!inv) return null;
  const star = inv.star || 0;
  if (star >= 5) return { max: true, star };
  const cost = upgradeCost(inv.rarity, star);
  return {
    star,
    nextStar: cost.nextStar,
    fragments: cost.fragments,
    stone: cost.stone,
    rarity: inv.rarity,
  };
}

export async function upgrade({ itemId }) {
  if (!isCloud()) return upgradeLocal({ itemId });

  const data = await request('/api/upgrade', { method: 'POST', body: { itemId } });
  save.update((d) => {
    d.wallet = { ...d.wallet, ...data.wallet };
    d.meta.power = data.power;
  });
  await refreshMe();
  return data;
}

function upgradeLocal({ itemId }) {
  return new Promise((resolve, reject) => {
    const data = save.getSave();
    const inv = data.inventory[itemId];
    if (!inv) return reject(new Error('尚未拥有该卡'));
    const star = inv.star || 0;
    if (star >= 5) return reject(new Error('已满星'));

    const cost = upgradeCost(inv.rarity, star);
    if ((data.wallet.fragments || 0) < cost.fragments) return reject(new Error('升星碎片不足'));
    if ((data.wallet.stone || 0) < cost.stone) return reject(new Error('进阶石不足'));

    save.update((s) => {
      s.wallet.fragments -= cost.fragments;
      s.wallet.stone -= cost.stone;
      s.inventory[itemId].star = cost.nextStar;
      s.meta.power = computePower(s.inventory);
    });

    const after = save.getSave();
    resolve({
      item: { itemId, name: inv.name, rarity: inv.rarity, star: after.inventory[itemId].star },
      wallet: after.wallet,
      power: after.meta.power,
    });
  });
}

// ---------------------------------------------------------------- 排行榜 / 对战

const BOT_NAMES = [
  '咸鱼翻身', '非酋本酋', '十连全R', '欧皇附体', '保底战神', '单抽出货',
  '囤石狂魔', '抽卡上头', '非洲酋长', '天选之人', '玄不改非', '氪不改命',
  '概率绝缘', '锦鲤本鲤', '许愿池王', '欧气满满', '沉船船长', '井底之蛙',
  '星轨旅人', '全服博弈', '荣耀王者', '荣耀积攒', '图鉴收集家', '升星狂热',
  '碎片富翁', '进阶石矿主', '排位守门员', '榜一大哥', '榜一大姐', '摸鱼选手',
  '凌晨三点', '下班抽卡', '午休一发', '周末爆肝', '月卡党', '零氪之光',
  '微氪玩家', '重氪大佬', '佛系抽卡', '硬核收集',
];

function generateBots(myPower) {
  const B = Math.max(myPower, 100);
  const bots = [];
  for (let i = 0; i < BOT_NAMES.length; i++) {
    const mult = 0.25 + 0.05 * i; // 0.25x ~ 2.20x
    const jitter = 0.9 + ((i * 37) % 20) / 100; // 0.90 ~ 1.09 稳定抖动
    const power = Math.max(20, Math.round(B * mult * jitter));
    bots.push({ id: `bot|${BOT_NAMES[i]}|${power}`, name: BOT_NAMES[i], power, isMe: false });
  }
  return bots;
}

export async function leaderboard() {
  if (isCloud()) return request('/api/leaderboard');
  return leaderboardLocal();
}

function leaderboardLocal() {
  return new Promise((resolve) => {
    const data = save.getSave();
    const myPower = data.meta.power || 0;
    const players = generateBots(myPower);
    players.push({ id: 'me', name: '你', power: myPower, isMe: true });
    players.sort((a, b) => b.power - a.power);
    const rows = players.map((p, idx) => ({ rank: idx + 1, ...p }));
    const meRow = rows.find((r) => r.isMe);
    let view = rows.slice(0, 50);
    if (!view.includes(meRow)) view = view.concat([meRow]);
    resolve({ me: { rank: meRow.rank, power: myPower }, rows: view });
  });
}

export async function pk({ opponentId }) {
  // 真人对手才需要服务端结算；内置对手本地算即可。
  if (!isCloud() || !opponentId || String(opponentId).startsWith('bot|')) {
    return pkLocal({ opponentId });
  }

  const data = await request('/api/pk', { method: 'POST', body: { opponentId } });
  save.update((d) => {
    d.wallet = { ...d.wallet, ...data.wallet };
    if (data.win) d.meta.pkWin = (d.meta.pkWin || 0) + 1;
    else d.meta.pkLose = (d.meta.pkLose || 0) + 1;
  });
  return data;
}

function pkLocal({ opponentId }) {
  return new Promise((resolve) => {
    const data = save.getSave();
    const myPower = data.meta.power || 0;
    let oppName = '对手';
    let oppPower = Math.round(myPower * (0.85 + Math.random() * 0.3));

    if (opponentId && String(opponentId).startsWith('bot|')) {
      const parts = String(opponentId).split('|');
      oppName = parts[1];
      oppPower = parseInt(parts[2], 10) || oppPower;
    }

    const myVal = myPower * (0.85 + 0.3 * Math.random());
    const oppVal = oppPower * (0.85 + 0.3 * Math.random());
    const win = myVal >= oppVal;

    save.update((s) => {
      if (win) {
        s.wallet.wish_stone += 5;
        s.wallet.stone += 1;
        s.meta.pkWin = (s.meta.pkWin || 0) + 1;
      } else {
        s.meta.pkLose = (s.meta.pkLose || 0) + 1;
      }
    });

    resolve({
      win,
      myVal: Math.round(myVal),
      oppVal: Math.round(oppVal),
      oppName,
      oppPower,
      wallet: save.getSave().wallet,
    });
  });
}

// ---------------------------------------------------------------- 历史

export async function fetchHistory(limit = 50) {
  if (isCloud()) {
    const data = await request(`/api/history?limit=${limit}`);
    return data.rows || [];
  }
  return save.getSave().history.slice(0, limit);
}
