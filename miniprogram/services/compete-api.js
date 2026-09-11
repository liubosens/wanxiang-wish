const save = require("../utils/save");

const BOT_NAMES = [
  "咸鱼翻身", "非酋本酋", "十连全R", "欧皇附体", "保底战神", "单抽出货",
  "囤石狂魔", "抽卡上头", "非洲酋长", "天选之人", "玄不改非", "氪不改命",
  "概率绝缘", "锦鲤本鲤", "许愿池王", "欧气满满", "沉船船长", "井底之蛙",
  "星轨旅人", "全服博弈", "荣耀王者", "荣耀积攒", "图鉴收集家", "升星狂热",
  "碎片富翁", "进阶石矿主", "排位守门员", "榜一大哥", "榜一大姐", "摸鱼选手",
  "凌晨三点", "下班抽卡", "午休一发", "周末爆肝", "月卡党", "零氪之光",
  "微氪玩家", "重氪大佬", "佛系抽卡", "硬核收集"
];

// 本地无服务端时，用 bots 模拟排行榜（确定性、围绕玩家战力分布）
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

function leaderboardLocal() {
  const data = save.getSave();
  const myPower = data.meta.power || 0;
  const players = generateBots(myPower);
  players.push({ id: "me", name: "你", power: myPower, isMe: true });
  players.sort((a, b) => b.power - a.power);
  const rows = players.map((p, idx) => ({ rank: idx + 1, ...p }));
  const meRow = rows.find((r) => r.isMe);
  // 只展示前 50 名；若自己不在其中则追加自己一行
  let view = rows.slice(0, 50);
  if (!view.includes(meRow)) view = view.concat([meRow]);
  return { me: { rank: meRow.rank, power: myPower }, rows: view };
}

function pkLocal({ opponentId }) {
  const data = save.getSave();
  const myPower = data.meta.power || 0;
  let oppName = "对手";
  let oppPower = Math.round(myPower * (0.85 + Math.random() * 0.3));

  if (opponentId && opponentId.startsWith("bot|")) {
    const parts = opponentId.split("|");
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

  return {
    win,
    myVal: Math.round(myVal),
    oppVal: Math.round(oppVal),
    oppName,
    oppPower,
    wallet: save.getSave().wallet
  };
}

async function leaderboard() {
  const app = getApp();
  if (app.globalData.useCloud && wx.cloud) {
    const res = await wx.cloud.callFunction({ name: "leaderboard", data: {} });
    if (res.result && res.result.ok) return res.result.data;
    throw new Error((res.result && res.result.message) || "排行榜加载失败");
  }
  return leaderboardLocal();
}

async function pk({ opponentId }) {
  const app = getApp();
  if (app.globalData.useCloud && wx.cloud && opponentId && !opponentId.startsWith("bot|")) {
    const res = await wx.cloud.callFunction({ name: "pk", data: { opponentId } });
    if (res.result && res.result.ok) return res.result.data;
    throw new Error((res.result && res.result.message) || "PK 失败");
  }
  return pkLocal({ opponentId });
}

module.exports = { leaderboard, pk, leaderboardLocal, pkLocal };
