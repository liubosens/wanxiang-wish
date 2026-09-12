// 任务/成就定义 —— 数据驱动配置（规格：design/gdd/quests-spec.md）。
// 数值全部 [PLACEHOLDER] 待校准；stone 只进全勤宝箱/周任务/成就（供给节奏控制点）。
//
// 两类任务：
// - 计数型（event）：由服务端事务内埋点 bumpQuestProgress 累加（draw/upgrade/pk/tower/server_pity）
// - 状态型（stat）：进度不落库，读取时从 user 档案惰性重算（collect/star/ur/total_draws/power）

export type QuestType = 'daily' | 'weekly' | 'achievement' | 'event';
export type QuestEvent =
  | 'draw'
  | 'upgrade'
  | 'pk_attempt'
  | 'pk_win'
  | 'tower_challenge'
  | 'tower_clear'
  | 'exchange'
  | 'server_pity';
export type QuestStat = 'collect' | 'star' | 'ur' | 'total_draws' | 'power';

export interface QuestDef {
  questId: string;
  type: QuestType;
  title: string;
  target: number;
  reward: Record<string, number>;
  sort: number;
  // 计数型：埋点事件名
  event?: QuestEvent;
  // 状态型：惰性重算口径
  stat?: QuestStat;
  // 状态型 collect/star/ur 的世界过滤（卡 id 前缀）：genshin_ / sg_ / wz_
  world?: string;
  // type='event'（festival_quest 活动任务）：所属活动 id，period_key = 'E:{eventId}'
  eventId?: string;
}

const WORLDS = [
  { key: 'genshin', prefix: 'genshin_', name: '原神' },
  { key: 'sangokushi', prefix: 'sg_', name: '三国杀' },
  { key: 'wangzhe', prefix: 'wz_', name: '王者' },
] as const;

export const DAILY_QUESTS: QuestDef[] = [
  { questId: 'd_draw10', type: 'daily', title: '抽卡 10 次', target: 10, reward: { wish_stone: 5 }, sort: 1, event: 'draw' },
  { questId: 'd_tower1', type: 'daily', title: '试炼塔挑战 1 次', target: 1, reward: { chest_key: 1 }, sort: 2, event: 'tower_challenge' },
  { questId: 'd_pk3', type: 'daily', title: '参与 PK 3 次', target: 3, reward: { machine_coin: 3 }, sort: 3, event: 'pk_attempt' },
  { questId: 'd_upgrade1', type: 'daily', title: '升星 1 次', target: 1, reward: { dust: 30 }, sort: 4, event: 'upgrade' },
];

// 全勤宝箱：当日 4 条 daily 全部领取后开启（独立领取行，questId 固定）
export const DAILY_BOX: QuestDef = {
  questId: 'd_daily_box', type: 'daily', title: '全勤宝箱', target: 4,
  reward: { stone: 1, wish_stone: 5 }, sort: 9,
};

export const WEEKLY_QUESTS: QuestDef[] = [
  { questId: 'w_draw70', type: 'weekly', title: '累计抽卡 70 次', target: 70, reward: { wish_stone: 15 }, sort: 1, event: 'draw' },
  { questId: 'w_tower15', type: 'weekly', title: '试炼塔通关 15 层', target: 15, reward: { stone: 2 }, sort: 2, event: 'tower_clear' },
  { questId: 'w_pk10', type: 'weekly', title: 'PK 获胜 10 场', target: 10, reward: { chest_key: 3 }, sort: 3, event: 'pk_win' },
];

function buildAchievements(): QuestDef[] {
  const list: QuestDef[] = [];
  for (const w of WORLDS) {
    // 收集层：图鉴 6 / 10 / 12 张
    for (const [i, t] of [6, 10, 12].entries()) {
      list.push({
        questId: `ach_${w.key}_collect_${t}`, type: 'achievement',
        title: `${w.name}图鉴收集 ${t} 张`, target: t,
        reward: { stone: [3, 5, 10][i] }, sort: 10 + i, stat: 'collect', world: w.prefix,
      });
    }
    // 强化层：任意卡 3 星 / 5 星
    list.push({
      questId: `ach_${w.key}_star3`, type: 'achievement',
      title: `${w.name}任意卡升到 3 星`, target: 3, reward: { stone: 5 }, sort: 13, stat: 'star', world: w.prefix,
    });
    list.push({
      questId: `ach_${w.key}_star5`, type: 'achievement',
      title: `${w.name}任意卡升到 5 星`, target: 5, reward: { stone: 15 }, sort: 14, stat: 'star', world: w.prefix,
    });
    // 极致层：UR ≥1 / ≥2（王者仅 1 张 UR，ur2 对其不可达，仍保留定义但恒未激活——下版本可替换条件）
    list.push({
      questId: `ach_${w.key}_ur1`, type: 'achievement',
      title: `${w.name}收集 1 张 UR`, target: 1, reward: { wish_stone: 30 }, sort: 15, stat: 'ur', world: w.prefix,
    });
    list.push({
      questId: `ach_${w.key}_ur2`, type: 'achievement',
      title: `${w.name}收集 2 张 UR`, target: 2, reward: { wish_stone: 30 }, sort: 16, stat: 'ur', world: w.prefix,
    });
  }
  // 通用组：累计抽卡 / 总战力 / 全服保底亲历
  const drawTiers: Array<[number, number]> = [[100, 10], [500, 30], [2000, 100]];
  for (const [t, ws] of drawTiers) {
    list.push({
      questId: `ach_draw_${t}`, type: 'achievement',
      title: `累计抽卡 ${t} 次`, target: t, reward: { wish_stone: ws }, sort: 1, stat: 'total_draws',
    });
  }
  const powerTiers: Array<[number, number]> = [[300, 50], [600, 150], [900, 400]];
  for (const [t, dust] of powerTiers) {
    list.push({
      questId: `ach_power_${t}`, type: 'achievement',
      title: `总战力达到 ${t}`, target: t, reward: { dust }, sort: 2, stat: 'power',
    });
  }
  list.push({
    questId: 'ach_server_pity_1', type: 'achievement',
    title: '亲历全服保底触发 1 次', target: 1, reward: { dust: 200 }, sort: 3, event: 'server_pity',
  });
  return list;
}

export const ACHIEVEMENTS: QuestDef[] = buildAchievements();

export const ALL_COUNTED_QUESTS: QuestDef[] = [
  ...DAILY_QUESTS,
  ...WEEKLY_QUESTS,
  ...ACHIEVEMENTS.filter((a) => a.event),
];
