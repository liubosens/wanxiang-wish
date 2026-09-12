// 试炼塔配置 —— 曲线锚点 / 奖励表 / 守将池（规格：design/gdd/trial-tower-spec.md）。
// 数值全部 [PLACEHOLDER]：上线后按全服 users.power 分位数季度校准（层10=P25 层20=P50 层30=P75 层40=P95 反解锚点）。

export const TOWER = {
  floorMax: 50,
  dailyChallenges: 3,
  // 敌力几何曲线：enemyPower(n) = round(P_min × (P_max/P_min)^((n-1)/(floorMax-1)))
  pMin: 60, // 第 1 层 ≈ 新手首日战力的 40%
  pMax: 1100, // 顶层 ≈ 理论满配（5×UR 5星×羁绊上限 ≈1035）的 106%
  milestoneEvery: 5, // 每 5 层里程碑
  rewards: {
    firstClear: { fragments: 10, dust: 20 }, // 每层首通
    milestone: { stone: 3, wish_stone: 10 }, // 里程碑首通（叠加在 firstClear 上）
    sweep: { fragments: 20, dust: 40 }, // 每日扫荡（无 stone）
    consolation: { dust: 10 }, // 挑战失败安慰奖（2026-09 拍板）
  },
} as const;

export function enemyPower(floor: number): number {
  if (floor < 1) return TOWER.pMin;
  const n = Math.min(floor, TOWER.floorMax);
  return Math.round(
    TOWER.pMin * Math.pow(TOWER.pMax / TOWER.pMin, (n - 1) / (TOWER.floorMax - 1)),
  );
}

export function isMilestone(floor: number): boolean {
  return floor > 0 && floor % TOWER.milestoneEvery === 0;
}

// 守层敌将：复用三世界卡牌名 + "魔化·"前缀（零美术资产，trial-tower-spec §6）。
// 50 层轮换取池内第 (n-1)%len 位。
const GUARDIANS: Array<{ name: string; rarity: string }> = [
  { name: '荧', rarity: 'R' }, { name: '空', rarity: 'R' }, { name: '温迪', rarity: 'R' },
  { name: '魈', rarity: 'R' }, { name: '枫原万叶', rarity: 'R' }, { name: '提瓦特', rarity: 'R' },
  { name: '胡桃', rarity: 'SR' }, { name: '甘雨', rarity: 'SR' },
  { name: '神里绫华', rarity: 'SR' }, { name: '纳西妲', rarity: 'SR' },
  { name: '雷电将军', rarity: 'UR' }, { name: '钟离', rarity: 'UR' },
  { name: '刘备', rarity: 'R' }, { name: '孙权', rarity: 'R' }, { name: '司马懿', rarity: 'R' },
  { name: '赵云', rarity: 'R' }, { name: '张飞', rarity: 'R' }, { name: '黄月英', rarity: 'R' },
  { name: '曹操', rarity: 'SR' }, { name: '诸葛亮', rarity: 'SR' },
  { name: '周瑜', rarity: 'SR' }, { name: '关羽', rarity: 'SR' },
  { name: '吕布', rarity: 'UR' }, { name: '左慈', rarity: 'UR' },
  { name: '韩信', rarity: 'R' }, { name: '鲁班七号', rarity: 'R' }, { name: '嬴政', rarity: 'R' },
  { name: '露娜', rarity: 'R' }, { name: '后羿', rarity: 'R' }, { name: '妲己', rarity: 'R' },
  { name: '李白', rarity: 'SR' }, { name: '貂蝉', rarity: 'SR' },
  { name: '花木兰', rarity: 'SR' }, { name: '公孙离', rarity: 'SR' }, { name: '典韦', rarity: 'SR' },
  { name: '武则天', rarity: 'UR' },
];

export function guardianOf(floor: number): { name: string; rarity: string; power: number } {
  const g = GUARDIANS[(floor - 1) % GUARDIANS.length];
  return { name: `魔化·${g.name}`, rarity: g.rarity, power: enemyPower(floor) };
}
