// 图鉴羁绊组合 —— 同世界指定卡组合 → 全局战力加成（外乘）。
// 规格：design/gdd/collection-bonds-spec.md。数值 [PLACEHOLDER] 待校准。
// 与 cloudflare/src/bonds-config.ts 同源：改动必须同步（改公式三处同步铁律新增本文件）。
export const BOND_CAP = 0.15;

export const BONDS = [
  // 原神区
  { bondId: 'gs_chenshi', world: 'genshin', worldName: '原神', name: '尘世闲游',
    itemIds: ['genshin_ying', 'genshin_kong', 'genshin_wendy'], bonus: 0.02 },
  { bondId: 'gs_wangsheng', world: 'genshin', worldName: '原神', name: '往生堂',
    itemIds: ['genshin_hutao', 'genshin_zhongli'], bonus: 0.03 },
  { bondId: 'gs_yisheng', world: 'genshin', worldName: '原神', name: '一心净土',
    itemIds: ['genshin_raiden', 'genshin_nahida', 'genshin_ayaka'], bonus: 0.05 },
  // 三国杀区
  { bondId: 'sg_taoyuan', world: 'sangokushi', worldName: '三国杀', name: '桃园结义',
    itemIds: ['sg_liubei', 'sg_guanyu', 'sg_zhangfei'], bonus: 0.03 },
  { bondId: 'sg_chibi', world: 'sangokushi', worldName: '三国杀', name: '火烧赤壁',
    itemIds: ['sg_zhouyu', 'sg_zhugeliang', 'sg_huang'], bonus: 0.04 },
  { bondId: 'sg_xianmo', world: 'sangokushi', worldName: '三国杀', name: '仙魔同源',
    itemIds: ['sg_lvbu', 'sg_zuoci'], bonus: 0.04 },
  // 王者区
  { bondId: 'wz_guojin', world: 'wangzhe', worldName: '王者', name: '沙场巾帼',
    itemIds: ['wz_hualan', 'wz_luona'], bonus: 0.02 },
  { bondId: 'wz_jianwu', world: 'wangzhe', worldName: '王者', name: '剑舞惊鸿',
    itemIds: ['wz_libai', 'wz_gongsun'], bonus: 0.03 },
  { bondId: 'wz_qiangu', world: 'wangzhe', worldName: '王者', name: '千古一帝',
    itemIds: ['wz_yingzheng', 'wz_wuze'], bonus: 0.05 },
];

function ownedCount(bond, inventory) {
  return bond.itemIds.filter((id) => (inventory?.[id]?.count || 0) > 0).length;
}

// 全部羁绊的当前状态：activated = 组合内所有卡均已拥有（count>0，与星级无关）。
export function bondStates(inventory) {
  return BONDS.map((b) => {
    const owned = ownedCount(b, inventory);
    return { ...b, ownedCount: owned, activated: owned === b.itemIds.length };
  });
}

// 已激活加成之和（加算，未封顶）
export function bondBonusSum(inventory) {
  return bondStates(inventory)
    .filter((s) => s.activated)
    .reduce((sum, s) => sum + s.bonus, 0);
}

// 外乘用最终加成（封顶 BOND_CAP）
export function bondBonus(inventory) {
  return Math.min(bondBonusSum(inventory), BOND_CAP);
}
