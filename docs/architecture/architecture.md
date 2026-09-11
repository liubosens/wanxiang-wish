# 万象祈愿 · 系统架构（Phase 3 · engineering-lead 交付）

> 三层结构：客户端 / 云函数 / 云数据库。复用现有 `roll-engine`，不重写。
> 评审强度 = full；首冲刺 = 全栈垂直切片。

## 1. 架构总览
```
[小程序客户端]
  pages: gallery / scene-banner(原神) / scene-chest(三国) / scene-machine(王者)
         / inventory / history / rates / profile / leaderboard(新增) / pk(新增)
  services/draw-api.js  ── draw({poolId,times}) ─┐ 本地(offline)  ┌─ utils/save.js
                                                ├──────────────┤
  [云函数]                                        └ 云端(wx.cloud)┘
    draw/        读 users.pity → roll-engine → 写 users/history + server_pity(三国)
    getPool/     返回池配置(概率公示)
    history/     历史记录查询
    login/       openid 登录态
    upgrade/     [新增] 升星 → 扣资源 → star+1 → 重算 power
    exchange/    [新增] 王者积分兑换 UR
    leaderboard/ [新增] 按 power 排序读榜
    pk/          [新增] 异步方差结算 + 发奖
  [云数据库]
    users / history / draw_tokens / server_pity / (leaderboard 用 users 查询)
```

## 2. ADR

### ADR-1 云激活与 envId 策略
- 保留 `app.js.useCloud` 开关；用户开通云开发并给 envId 后，置 `useCloud:true`、`envId` 填真实值。
- `draw-api.draw` 已自动选云/本地，**本地作离线兜底**：未激活云时仍可玩，激活后切云端。
- 决策：不删本地路径，双轨直到云稳定。

### ADR-2 数据库集合 Schema
- `users`：`{ openid, wallet{wish_stone,chest_key,machine_coin,dust}, inventory{itemId:{count,name,rarity,star}}, codex, pity{poolId:{...}}, power:Number, pkWin:Number, pkLose:Number, createdAt }`
- `history`：`{openid,poolId,poolName,itemId,name,rarity,at}`
- `draw_tokens`：`{_id:"${openid}_${clientToken}", at}`（防重放）
- `server_pity`：`{ poolId, count:Number }`（全服累积保底计数器）
- 排行榜：MVP 直接 `db.collection("users").orderBy("power","desc")`；建 `power` 降序索引。

### ADR-3 全服保底（服务端状态）
- `server_pity` 按 `poolId` 存计数器；`draw` 云函数每抽 `count += 1`（含"其他玩家"模拟增量），达 `threshold` → 本次强制 UR 并 `count = 0`。
- 并发安全：用云 db `.update({data:{count: _.inc(1)}})` 自增 + 读回判断，或事务；避免竞态导致多人在阈值同刻都触发（可接受少量重叠，[PLACEHOLDER] 校准）。
- 客户端无需感知，服务端在结果中标记 `serverPityTriggered`。

### ADR-4 升星 / 战力 云同步
- 升星走云函数 `upgrade`：校验 `fragments`/`stone` → 扣减 → `star+1` → 按 `progression-spec` 重算 `power` → 写 `users`。
- 防篡改：战力由云重算（不只客户端上报）；本地仅展示。

### ADR-5 排行榜 / PK 云函数
- `leaderboard`：`orderBy("power","desc").limit(N)` + 自身名次。
- `pk`：收 `opponentId` → 方差结算（见 competitive-spec）→ 事务写 `pkWin/pkLose` + 发奖。

## 3. 垂直切片 Epic 拆分（production/epics/）
- **E1 三世界卡池接入**（pools + 场景页 poolId）→ ✅ 原神/三国/王者 world 本地可玩
- **E2 三国杀全服保底**（server_pity + draw 改造）→ ✅ 本地+云两侧骨架已接（`roll-engine` 的 `forceRarity` 钩子两端已对齐）
- **E3 王者积分兑换**（exchange 云函数）→ ✅ `cloudfunctions/exchange` + `services/exchange-api.js` + scene-machine 兑换 UI
- **E4 升星 + 战力**（upgrade + power 上报/重算）→ ✅
  - E4a 碎片/进阶石经济：重复卡→`wallet.fragments`(R5/SR30/UR80)，`stone` 日常+1
  - E4b 升星：`upgrade` 云函数 + `services/upgrade-api.js` + inventory 升星按钮；成本 `10×(s+1)×rarMult`，≥3星额外 `stone`
  - E4c 战力：`computePower`=Σ 最优5张 `rarWeight×(1+0.25×star)`；抽卡/升星/兑换后更新 `meta.power` 并上报 `users.power`
- **E5 排行榜 + PK**（云函数 + 页面）→ ✅ `leaderboard`/`pk` 云函数 + `services/compete-api.js`(本地 bots) + `pages/leaderboard`(tabBar) / `pages/pk`
- 依赖：E2/E3/E4 依赖 design/gdd/worlds-spec、progression-spec；E5 依赖 competitive-spec。

## 4. 质量门（full 评审强度）
- **E0 诊断**：现有引擎非空白，沿其补三世界机制 + 激活云（非重写）。✅
- **设计闸门**：fun hypothesis / pillars / 三层 loop / sources-sinks / 三世界机制 / 竞争层 均经 gdd-01~05 + design/gdd/*-spec 固化。✅
- **架构闸门**：ADR-1~5 已定，双轨（本地兜底+云端）。✅
- **烟雾测试（本地逻辑，node stub）**：抽卡→重复卡转化碎片→王者兑换武则天(UR)→升星→排行榜(bots)→PK→胜发奖，25 项断言全过。✅
  - ⚠️ 修复项：`roll-engine.js` 的 `forceRarity` 钩子此前漏绑参数（引用未声明变量），两端均已补 `const forceRarity = (options&&options.forceRarity)||null; let forceUsed=false;`。
- **待用户交付（阻塞云端）**：
  1. 微信开发者工具开通云开发，提供 `envId` → 激活 `app.js` 的 `useCloud:true` + `envId`。
  2. 云数据库建集合：`users` / `history` / `draw_tokens` / `server_pity`（并给 `users.power` 建降序索引）。
  3. 上传 8 个云函数：`draw` `getPool` `history` `login` `exchange` `upgrade` `leaderboard` `pk`。
  4. 王者 `exchange` 资源：`cloudfunctions/exchange/pools/c2_wangzhe_v1.json` 已随函数就位。
- **数值校准（playtest 项，[PLACEHOLDER]）**：全服保底 `threshold:80`、王者 `exchange.cost:30`、进阶石来源节奏、战力权重，需按真实 DAU/节奏校准；进阶石不足会卡在 3 星（已用每日+1 + 原型初始 stone:3 缓解）。
