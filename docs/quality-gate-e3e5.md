# 万象祈愿 · E3–E5 交付与质量门（全栈垂直切片）

> 阶段：E1/E2 已完成（见 architecture.md），本交付补齐 **E3 王者兑换 / E4 升星+战力 / E5 排行榜+PK**。
> 评审强度 = full；首冲刺 = 全栈垂直切片。所有代码保持「本地兜底 + 云端」双轨（ADR-1）。

## 一、本次新增/修改清单

### 经济与战力内核（client + cloud 同源）
- `miniprogram/utils/power.js`（新增，client 权威公式）
  - `RAR_MULT{R:1,SR:2,UR:3}`、`RAR_WEIGHT{R:10,SR:30,UR:80}`、`DUP_FRAG{R:5,SR:30,UR:80}`
  - `upgradeCost(rarity, star)`：碎片 `10×(s+1)×rarMult`；目标星 ≥3 额外 `stone=(s+1-2)×rarMult`
  - `computePower(inv)`：编队最优 5 张 `rarWeight×(1+0.25×star)` 之和
- `cloudfunctions/{draw,exchange,upgrade}/power.js`（新增，上述公式的部署副本，供云函数自包含）
- `miniprogram/utils/save.js`：`wallet` 增 `fragments/stone`；`meta` 增 `power/pkWin/pkLose`；`claimDaily` 每日 +1 `stone`；新增 `recalcPower()`
- `miniprogram/utils/pools.js`：新增 `totalCards()`（图鉴完成度口径）

### E3 王者积分兑换
- `cloudfunctions/exchange/index.js` + `cloudfunctions/exchange/pools/c2_wangzhe_v1.json`（服务端校验 `point_wz` → 发武则天 UR → 重算战力）
- `miniprogram/services/exchange-api.js`（本地兜底 + 双轨）
- `pages/scene-machine`：展示荣耀积分、兑换进度条、兑换按钮

### E4 升星 + 战力
- `cloudfunctions/upgrade/index.js`（服务端校验资源 → `star+1` → 重算战力）
- `miniprogram/services/upgrade-api.js`（本地兜底 + 双轨 + `previewCost` 供 UI）
- `pages/inventory`：展示 ★、下一级成本、升星按钮
- `pages/profile`：展示战力、图鉴完成度%、资源、PK 战绩、排行榜入口
- `draw-api` / `exchange` / `upgrade` / `draw 云函数` 四处均在动作后更新 `meta.power` 并上报 `users.power`

### E5 排行榜 + PK
- `cloudfunctions/leaderboard/index.js`（读榜 + 自身名次，基于 `users.power`）
- `cloudfunctions/pk/index.js`（方差结算 + 写战绩 + 发奖 `wish_stone+5 / stone+1`；排名只由 `power` 决定）
- `miniprogram/services/compete-api.js`（本地用 40 个 bots 模拟榜单与对手；云端走真实函数）
- `pages/leaderboard`（tabBar 第 5 项，"挑战上一名" → PK）、`pages/pk`（对战 + 结果 + 再战）
- `app.json`：注册两页面，排行榜进 tabBar

### 关键修复
- **`roll-engine.js` 的 `forceRarity` 钩子此前漏绑参数**：引用了未声明的 `forceRarity`/`forceUsed` 变量。已补齐
  `const forceRarity = (options&&options.forceRarity)||null; let forceUsed=false;`（client 与 cloud 两端均已对齐）。
  该钩子是三国杀全服保底 `server_pity` 强制出 UR 的入口，修复前会导致云/本地抽卡直接报错。

## 二、烟雾测试结果（本地逻辑，Node stub wx/getApp）
抽卡 → 重复卡转化碎片 → 王者兑换武则天(UR) → 升星 → 排行榜(bots) → PK → 胜发奖，**25 项断言全过**。

## 三、阻塞云端交付（需用户提供 envId 后激活）
1. 微信开发者工具开通云开发，给 `envId` → 置 `app.js` 的 `useCloud:true`、`envId` 真实值。
2. 云数据库建集合：`users` / `history` / `draw_tokens` / `server_pity`；给 `users.power` 建降序索引。
3. 上传 8 个云函数：`draw` `getPool` `history` `login` `exchange` `upgrade` `leaderboard` `pk`。
4. 数值校准（[PLACEHOLDER]）：全服保底 `threshold:80`、王者 `exchange.cost:30`、进阶石来源节奏、战力权重，需按真实 DAU/节奏 playtest；进阶石不足会卡 3 星（已用每日+1 + 原型初始 `stone:3` 缓解）。

## 四、当前可玩路径（本地，无需云）
概率馆(gallery) → 三场景抽卡 → 背包(升星/看战力) → 我的(战力/图鉴%/资源/排行榜入口) → 排行榜 → 对战。
