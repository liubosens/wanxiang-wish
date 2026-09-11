# 万象祈愿 · 三世界卡池规格（Phase 4 设计闸门 · design-strategist 交付）

> 把 gdd-04（三世界机制）映射到现有 `miniprogram/lib/roll-engine.js` 可直接消费的池配置。
> 所有数值标 [PLACEHOLDER]，需 playtest 校准；禁止 magic number。

## 1. 世界 → 页面 / 货币 / 机制 映射
| 世界 | 页面 | 货币 | poolId | 机制 | 引擎支持度 |
|------|------|------|--------|------|-----------|
| 原神区 | `scene-banner` | `wish_stone` | `a1_genshin_v1` | 私域阶梯保底（小/大保底） | ✅ roll-engine 原生（up.loseStreak） |
| 三国杀区 | `scene-chest` | `chest_key` | `b1_sangokushi_v1` | 全服累积保底 | ⚠️ 需新增 `server_pity` 服务端状态 |
| 王者区 | `scene-machine` | `machine_coin` | `c2_wangzhe_v1` | 积分兑换（不赌） | ⚠️ 需新增 `exchange` 动作 |

## 2. 原神区 `a1_genshin_v1`（私域阶梯保底）
标准分支（`sceneType` 缺省即走 rarities/up 逻辑）。UR 走 up 小/大保底：
- `softPityStart: 74`、`hardPity: 90`
- `up.enabled`、`loseStreakKey: "up_lose"`、`maxLoseThenGuaranteed: 1`、`ssrUpRate: 0.5`、`itemIds: ["genshin_raiden"]`

```json
{
  "poolId": "a1_genshin_v1",
  "name": "原神·星轨祈愿",
  "sceneType": "A1",
  "presentation": "banner",
  "cost": { "itemId": "wish_stone", "amount": 1 },
  "multi": { "tenGuaranteeRarity": "SR" },
  "rarities": [
    { "id": "R",  "weight": 940 },
    { "id": "SR", "weight": 51,  "softPityStart": 74, "softPityStep": 60, "hardPity": 90 },
    { "id": "UR", "weight": 9,   "softPityStart": 74, "softPityStep": 600, "hardPity": 90 }
  ],
  "up": {
    "enabled": true, "rarity": "UR", "loseStreakKey": "up_lose",
    "maxLoseThenGuaranteed": 1, "ssrUpRate": 0.5, "itemIds": ["genshin_raiden"]
  },
  "lootTables": {
    "R":  [ {"itemId":"genshin_ying","name":"荧","weight":1}, {"itemId":"genshin_kong","name":"空","weight":1}, {"itemId":"genshin_wendy","name":"温迪","weight":1}, {"itemId":"genshin_xiao","name":"魈","weight":1}, {"itemId":"genshin_mao","name":"枫原万叶","weight":1}, {"itemId":"genshin_ti","name":"提瓦特","weight":1} ],
    "SR": [ {"itemId":"genshin_hutao","name":"胡桃","weight":1}, {"itemId":"genshin_ganyu","name":"甘雨","weight":1}, {"itemId":"genshin_ayaka","name":"神里绫华","weight":1}, {"itemId":"genshin_nahida","name":"纳西妲","weight":1} ],
    "UR": [ {"itemId":"genshin_raiden","name":"雷电将军","weight":50}, {"itemId":"genshin_zhongli","name":"钟离","weight":50} ]
  },
  "ratePublic": { "notes": ["五星(UR)基础概率约 0.9%，74 抽起软保底递增，90 抽硬保底。", "小保底 50% 出 UP，歪则大保底 100% 出 UP。"] }
}
```

## 3. 三国杀区 `b1_sangokushi_v1`（全服累积保底）
常规权重**不含 UR**（UR `weight: 0`），UR 仅由服务端 `server_pity` 计数器达阈值 T 时强制产出（详见 architecture ADR）。计数随全服每抽 +1（含"其他玩家"模拟），达 T 后下一次任意玩家抽卡必出 UR 并清零。

```json
{
  "poolId": "b1_sangokushi_v1",
  "name": "三国杀·全服博弈",
  "sceneType": "B1",
  "presentation": "chest",
  "cost": { "itemId": "chest_key", "amount": 1 },
  "multi": { "tenGuaranteeRarity": "SR" },
  "rarities": [
    { "id": "R",  "weight": 940 },
    { "id": "SR", "weight": 60, "softPityStart": 74, "softPityStep": 60, "hardPity": 90 },
    { "id": "UR", "weight": 0 }
  ],
  "serverPity": { "enabled": true, "threshold": 80, "rewardRarity": "UR" },
  "lootTables": {
    "R":  [ {"itemId":"sg_liubei","name":"刘备","weight":1}, {"itemId":"sg_sunquan","name":"孙权","weight":1}, {"itemId":"sg_simayi","name":"司马懿","weight":1}, {"itemId":"sg_zhaoyun","name":"赵云","weight":1}, {"itemId":"sg_zhangfei","name":"张飞","weight":1}, {"itemId":"sg_huang","name":"黄月英","weight":1} ],
    "SR": [ {"itemId":"sg_caocao","name":"曹操","weight":1}, {"itemId":"sg_zhugeliang","name":"诸葛亮","weight":1}, {"itemId":"sg_zhouyu","name":"周瑜","weight":1}, {"itemId":"sg_guanyu","name":"关羽","weight":1} ],
    "UR": [ {"itemId":"sg_lvbu","name":"吕布","weight":50}, {"itemId":"sg_zuoci","name":"左慈","weight":50} ]
  }
}
```
> `threshold: 80` 为原型值 [PLACEHOLDER]，需按真实 DAU 校准（全服量级越大 T 越小越频繁）。

## 4. 王者区 `c2_wangzhe_v1`（积分兑换）
原生只出 R/SR（UR `weight: 0`）；每抽 +1 `machine_coin` 兼作"荣耀积分"；满 `exchangeCost` 在 `exchange` 云函数兑换指定 UR（武则天），零赌博。

```json
{
  "poolId": "c2_wangzhe_v1",
  "name": "王者·荣耀积攒",
  "sceneType": "C2",
  "presentation": "machine",
  "cost": { "itemId": "machine_coin", "amount": 1 },
  "pointsPerDraw": 1,
  "exchange": { "itemId": "wz_wuze", "name": "武则天", "cost": 30 },
  "rarities": [
    { "id": "R",  "weight": 730 },
    { "id": "SR", "weight": 270 }
  ],
  "lootTables": {
    "R":  [ {"itemId":"wz_hanxin","name":"韩信","weight":1}, {"itemId":"wz_luban","name":"鲁班七号","weight":1}, {"itemId":"wz_yingzheng","name":"嬴政","weight":1}, {"itemId":"wz_luona","name":"露娜","weight":1}, {"itemId":"wz_houyi","name":"后羿","weight":1}, {"itemId":"wz_daji","name":"妲己","weight":1} ],
    "SR": [ {"itemId":"wz_libai","name":"李白","weight":1}, {"itemId":"wz_diaochan","name":"貂蝉","weight":1}, {"itemId":"wz_hualan","name":"花木兰","weight":1}, {"itemId":"wz_gongsun","name":"公孙离","weight":1}, {"itemId":"wz_dianwei","name":"典韦","weight":1} ]
  }
}
```
> `exchange.cost: 30` [PLACEHOLDER]，需按养成节奏校准。

## 5. 角色池汇总（各 12 名）
- **原神区**：R 荧/空/温迪/魈/枫原万叶/提瓦特 · SR 胡桃/甘雨/神里绫华/纳西妲 · UR 雷电将军(UP)/钟离
- **三国杀区**：R 刘备/孙权/司马懿/赵云/张飞/黄月英 · SR 曹操/诸葛亮/周瑜/关羽 · UR 吕布/左慈
- **王者区**：R 韩信/鲁班七号/嬴政/露娜/后羿/妲己 · SR 李白/貂蝉/花木兰/公孙离/典韦 · UR 武则天(兑换)

## 6. 实现约定
- `itemId` 前缀 `genshin_ / sg_ / wz_` 区分世界；`inventory` 与 `codex` 以 `itemId` 为键。
- 三池均保留 `multi.tenGuaranteeRarity` 十连保底。
- 三国杀/王者的 UR 产出走服务端逻辑，池配置中 `UR.weight: 0` 仅作占位，真实产出由 `serverPity` / `exchange` 控制。
