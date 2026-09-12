# 万象祈愿 · 排行榜 / PK 规格（Phase 4 设计闸门 · design-strategist 交付）

> gdd-05（战力 + 弱联机竞争层）的实现规格。数值 [PLACEHOLDER] 待校准。

## 1. 数据模型
- `users` 集合增加 `power`（Number，战力）字段，由升星/抽卡后写入。
- 新增 `leaderboard` 集合（或按月建 `leaderboard_YYYYMM`）存快照；MVP 直接查 `users` 排序。
- `users` 增加 `pkWin` / `pkLose`（战绩计数）。

## 2. 排行榜（弱联机·异步）
- 查询：`db.collection("users").orderBy("power","desc").limit(N)` → 返回 rank/name/power。
- 前端展示：前 N 名 + 玩家自身名次（"你"插入按 power 排序）。
- 名称/头像：微信授权昵称+头像（[PLACEHOLDER] 合规与隐私）。

## 3. PK（异步自动结算）
- UI："挑战上一名" → 取排名相邻对手。
- 结算：`myVal = power × (0.85 + 0.3×rand)`，`opVal = oppPower × (0.85 + 0.3×rand)`。
- 胜：`pkWin++`，奖励 `wish_stone +5`、`stone +1`（[PLACEHOLDER]）；败：`pkLose++`。（奖励受 §7 每日上限约束）
- **排名只由 `power` 决定**：PK 胜是资源事件 + 战绩，真爬榜必须升星抬战力（避免"赢了榜不动"割裂）。

## 4. 赛季制
- 周期 [PLACEHOLDER]（建议 30 天）：结算按名次发奖（资源/限定头像框），随后**软重置**排行榜（清空 rank 映射，保留 `power` 与收藏）。
- 目的：防战力通胀使排名失真（全员升星→榜通胀）。

## 5. 公平性与毒性防护
- 段位匹配 / 免战保护：MVP 可后置 [PLACEHOLDER]。
- PK 奖励仅为小资源**非硬通货**，避开 pay-to-win 毒性。
- 保留"图鉴完成度"作第二荣誉轴，缓解纯数值焦虑。

## 6. 云函数拆分
- `leaderboard`：读榜 / 报自己名次。
- `pk`：接收 opponentId，跑方差结算，写 `pkWin/pkLose` + 发奖（事务）。
- 两函数共用 `users` 集合，需建索引 `power` 降序。

## 7. PK 奖励上限（2026-09 拍板修订）

**背景**：`handlers/pk.ts` 原实现胜利 `stone +1` 且无次数上限 → 刷 PK 可无限获取进阶石，击穿升星经济（progression-spec §5 风险的反向放大）。

**规则**：
- 每日（UTC+8，`todayCN()` 口径）仅前 N 胜发放奖励，N=[PLACEHOLDER]，建议 5。
- 超限后**仍可无限 PK**：`pkWin/pkLose` 战绩照常累计、任务 `pk_attempt/pk_win` 计数照常（quests-spec §5），仅不再发放 wish_stone/stone。
- 上限计数实现：`users` 增加 `pk_reward_date`（TEXT）+ `pk_reward_wins`（INTEGER），或并入 quest 周期存储；切换自然日时清零（与 `last_daily_at` 同模式）。

**对齐影响**：
- 本规格 §3 的单次奖励值不变，仅加发放入口条件。
- expansion-overview §3.2 的 PK 月产出公式改为 `30 × min(实际日胜场, N) × P_win × S_pk`。
