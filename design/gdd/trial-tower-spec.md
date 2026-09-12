# 万象祈愿 · 试炼塔 PVE 规格（Phase 5 拓展 · design-strategist 交付）

> 爬层制单人 PVE，进阶石**主产出点**。结算复用 PK 的战力方差模型，保持"升星 → 变强 → 推层 → 拿石头 → 升星"闭环。
> 所有数值 [PLACEHOLDER]，敌力曲线需按全服 power 分布校准。

## 1. 机制定义

### 1.1 基本结构

- 50 层固定塔（[PLACEHOLDER] 层数），层号单调，通过第 n 层才能挑战第 n+1 层。
- 每层一个"守层敌将"（复用三世界卡牌做敌人皮肤，无需新美术资产：从各世界 lootTables 取名即可）。
- **每日挑战次数 3 次**（无论成败均消耗，UTC+8 `todayCN()` 重置）；失败不退次数——防无限重roll随机数。
- **扫荡**：每日可免费扫荡"已通最高层"1 次，固定成功，产出小额碎片/尘（**不给 stone**，stone 只在首通）。
- 塔不设赛季重置：best_floor 只升不降（荣誉进度），曲线靠分层校准（§1.3）。

### 1.2 敌力曲线（挂钩玩家 power 增长）

```
enemyPower(n) = round( P_min × (P_max / P_min) ^ ((n-1)/(FLOOR_MAX-1)) )
P_min  = 60   [PLACEHOLDER]   // 第 1 层 ≈ 新手首日战力（5×SR 0星=150 的 40%）
P_max  = 1100 [PLACEHOLDER]   // 顶层的 108% ≈ 理论满配 5×UR 5星×羁绊上限(≈1035)
FLOOR_MAX = 50 [PLACEHOLDER]
```

- 几何增长（每层 ×≈1.059），锚点：层 10 ≈ 180 / 层 20 ≈ 330 / 层 30 ≈ 600 / 层 40 ≈ 880 [PLACEHOLDER]。
- **校准方法**（上线后季度性重跑，不发版——锚点放配置）：以全服 `users.power` 分位数定锚——层 10 = power P25、层 20 = P50、层 30 = P75、层 40 = P95，反解 P_min/P_max。这使曲线自动跟踪玩家群成长，防"塔通胀"。
- 挑战层建议敌力 ≈ 玩家 power 的 100%~115% → 胜率 40~50%，升一星/激活羁绊后稳定推 2~3 层——**推层节奏直接挂钩战力增长**。

### 1.3 属性克制机制：结论——**MVP 不做，长期后置**

评估过的三个方案：

| 方案 | 描述 | 结论 |
|---|---|---|
| A. 纯战力对比 | `myVal = power×(0.85+0.3×rand)` vs `enemyPower` | ✅ **推荐**。与 PK（competitive-spec §3）同一套方差模型，实现零新增、认知零负担 |
| B. 世界属性克制 | 原神>三国杀>王者>原神，克制 +15% [PLACEHOLDER] | ❌ 当前**自动编队**（progression-spec §2）下玩家无编队决策空间，克制沦为不可控随机扰动，纯增认知过载；待手动编队上线后重评 |
| C. 阵容匹配结算 | 按羁绊数量/编队组合评分加权 | ❌ 依赖手动编队且结算不透明，与"弱联机轻交互"定位冲突，弃 |

### 1.4 奖励结构（stone 主产出）

| 类型 | 触发 | 奖励 [PLACEHOLDER] |
|---|---|---|
| 首通普通层 | 每层首次通过 | fragments ×10 + dust ×20 |
| 首通里程碑 | 每 5 层（5/10/15/…/50） | **stone ×3** + wish_stone ×10 |
| 每日扫荡 | 已通最高层扫荡 1 次/日 | fragments ×20 + dust ×40 |
| 挑战失败 | — | dust ×10（安慰奖，[PLACEHOLDER]，2026-09 拍板新增；次数照常消耗） |

stone 供给定位（对接总览 §3.2）：`F_new × S_firstClear`，中位月均新通 2 个里程碑 ≈ 6/月；里程碑是**一次性收入**，天然防刷、随玩家进度边际递减，无需复杂风控。

## 2. 数据模型（D1）

```sql
-- 0003_expansion.sql 片段
CREATE TABLE IF NOT EXISTS tower_state (
  openid        TEXT PRIMARY KEY,
  best_floor    INTEGER NOT NULL DEFAULT 0,   -- 已通最高层（0=未开塔）
  challenge_date TEXT,                        -- 'YYYY-MM-DD'（UTC+8），切日重置次数
  challenges_used INTEGER NOT NULL DEFAULT 0,
  sweep_date    TEXT,                         -- 当日是否已扫荡
  updated_at    INTEGER NOT NULL
);
```

曲线锚点与奖励表放**配置 JSON**（服务端常量 `tower-config.ts`，后续可迁 D1/KV 支持热调），不放 users 行。

## 3. 客户端 / 服务端分工

- **服务端**：塔状态、次数扣减、敌力计算、随机数（`createRng()`）、胜负判定、奖励发放、首通记录——全链路权威；同事务 `bumpQuestProgress('tower_challenge'/'tower_clear')`。
- **客户端**：塔 UI（层数、守将展示、剩余次数）、挑战动画表现、结算弹窗；胜负结果**只信**响应体。

## 4. API 设计

### GET /api/tower
```json
{
  "state": { "bestFloor": 17, "challengesLeft": 3, "sweepAvailable": true },
  "nextFloor": { "floor": 18, "enemy": { "name": "钟离", "rarity": "UR", "power": 305 } },
  "config": { "floorMax": 50, "milestones": [5,10,15,20,25,30,35,40,45,50] }
}
```

### POST /api/tower/challenge
请求 `{ "clientToken": "uuid" }`（复用 draw 幂等 token 机制，弱网防双扣次数）。
流程：校验次数 → 判 `myVal ≥ enemyPower(best_floor+1)` → 胜则 `best_floor+1`、发首通奖（查配置是否里程碑）；败则发安慰奖 dust×10 → 扣次数 → 写表 + 埋点。
响应 `{ "win": true, "floor": 18, "myVal": 312, "enemyPower": 305, "rewards": {...}, "wallet": {...}, "challengesLeft": 2 }`。

### POST /api/tower/sweep
无请求体；校验 `sweep_date ≠ todayCN()` → 固定成功，按 best_floor 档位发扫荡奖励。

## 5. 边缘情况

1. **开塔即顶**：老玩家上线时 power 远超层 1~N 敌力 → 允许挑战照常逐层打（3 次/日也是 3 层/日），不提供"跳层"。
   > **"开局战力定层跳层"方案——已否决（2026-09 拍板）**，论证存档如下：跳层可给老玩家一次性补发普通层首通奖励（不含里程碑）以缩短落差，但①一次性发放大量 fragments 会注入不可控供给脉冲，破坏首通奖励的边际递减防通胀设计（§1.4）；②跳层过程没有游戏行为发生，玩家对 best_floor 缺乏过程认同，塔的"推进感"核心体验被跳过；③统一从第 1 层爬塔保证全体玩家进度语义一致，运营与校准数据（全服 best_floor 分布）口径纯净。后续如再议，须先解决上述三点。
2. **跨零点挑战**：`challenge_date` 与 `todayCN()` 不一致时先重置 `challenges_used=0` 再扣减（与 `daily.ts` 同模式）。
3. **并发双击**：clientToken 幂等 + `challenges_used` 条件更新（`UPDATE ... SET challenges_used = challenges_used+1 WHERE openid=? AND challenges_used<3`），影响行数=0 即拒。
4. **curve 配置更新时 best_floor 超顶**：新锚点使某玩家 best_floor 对应敌力高于新顶层 → 不回退进度，仅后续层按新曲线。
5. **注销账号**：`tower_state`/`quest_progress` 随 `deleteUser` 批量清理（db.ts 的 batch 中追加）。

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 曲线定错 → 全服卡同一层（挫败）或一口气通塔（产出失控） | 上线首周锚点保守（偏难），用全服 power 分位数季度校准（§1.2）；里程碑 stone 为一次性收入，通塔不产生持续通胀 |
| 3 次/日 + 失败消耗 → 脸黑日体验差 | 方差 ±15% 与 PK 一致；失败给 dust×10 安慰奖（2026-09 拍板定稿，[PLACEHOLDER] 数值待校准） |
| 扫荡沦为纯挂机资源机 | 扫荡无 stone、奖励为碎片/尘小额；与每日签到同量级，不构成独立循环 |
| 敌将复用卡牌名造成"我打我自己"出戏 | 每层守将展示"魔化·"前缀或塔专属称号文案（纯文案层，零资产成本） |
