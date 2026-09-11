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
- 胜：`pkWin++`，奖励 `wish_stone +5`、`stone +1`（[PLACEHOLDER]）；败：`pkLose++`。
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
