# 万象祈愿 · 限时活动 / UP 池轮换 规格（Phase 5 拓展 · design-strategist 交付）

> 运营节奏器：双倍掉落周 / 限定 UP 池轮换 / 节日活动。**纯配置驱动，改配置即换活动，不发版。**
> 活动数值全部 [PLACEHOLDER]；奖励克制原则贯穿（§5）。

## 1. 机制定义

### 1.1 活动类型（type 枚举，运营按需扩展）

| type | 玩法 | 典型周期 |
|---|---|---|
| `double_frag` | 双倍碎片周：全池重复卡转碎片 ×2（`dupFragmentGain` 结算时读活动系数） | 1 周/月 |
| `up_rotation` | 限定 UP 池：原神区 banner 的 `up.itemIds` 轮换指定 UR（如 雷电将军 → 钟离） | 2~3 周/期 |
| `festival_daily` | 节日签到加码：`daily.ts` 的 REWARDS 在活动期被活动配置覆盖（如 stone 1→2） | 节日 3~7 天 |
| `festival_quest` | 节日任务组：附加 3~5 条限时任务（挂 quests 系统，`type:"event"`） | 节日同期 |
| `tower_boost` | 试炼塔挑战次数 +2 / 首通奖励加成 | 旺季穿插 |

### 1.2 活动日历（示例框架，具体档期运营定 [PLACEHOLDER]）

```
双周节奏：   周一 00:00 (UTC+8) 切换活动窗口
常驻骨架：   每月第 1 周 double_frag ＋ 第 2~3 周 up_rotation ＋ 第 4 周 tower_boost
节日插入：   春节/国庆等 7 天 festival_daily + festival_quest，覆盖当期骨架
```

同一时刻**至多 1 个全局活动生效**（简化认知：玩家只需理解"本周活动"一件事）；festival_daily 与 festival_quest 作为同一节日的双子活动可并存（视为一个活动档期）。

### 1.3 UP 池机制与现有三世界保底的兼容性

原神区 `a1_genshin_v1` 的 UP 轮换（唯一做 UP 轮换的池，保持机制聚焦）：

- **轮换物**：仅 `up.itemIds`（UP 角色）与 banner 展示文案；`rarities` 权重、softPity/hardPity、`ssrUpRate: 0.5` **全部不动**。
- **保底状态继承（2026-09 拍板定稿）**：`pity.up_lose`（歪了没歪的计数）与抽数计数**跨轮换继承、不重置**——本期歪了大保底，下期新 UP 角色直接必出。此为玩家友好的强承诺，**必须在池详情页（banner 页 ratePublic 区域）文案中明示**："UP 轮换不重置保底计数，大保底状态跨期继承"。轮换不重置计数属于规则级承诺，一旦上线不可回收。
- **三国杀全服保底**（server_pity）：与轮换无关，计数照常累积；若活动期换 UR 奖励对象（可选 [PLACEHOLDER]，需单独拍板），`rewardRarity` 不变仅换 lootTables 内权重，机制无感。
- **王者积分兑换**：不参与轮换（零赌博定位不动），节日最多做兑换 cost 限时 -5 [PLACEHOLDER]。

## 2. 数据模型（D1，数据驱动核心）

```sql
-- 0003_expansion.sql 片段
CREATE TABLE IF NOT EXISTS events (
  id        TEXT PRIMARY KEY,     -- 'evt_202602_a'
  type      TEXT NOT NULL,        -- 1.1 枚举
  title     TEXT NOT NULL,
  start_at  INTEGER NOT NULL,     -- ms 时间戳，UTC+8 语义由运营侧保证
  end_at    INTEGER NOT NULL,
  payload   TEXT NOT NULL,        -- JSON，按 type 定义 schema（见下）
  status    TEXT NOT NULL DEFAULT 'active'  -- active | ended | aborted（秒级熔断开关）
);
CREATE INDEX IF NOT EXISTS idx_events_window ON events(start_at, end_at);
```

payload schema（按 type）：

```jsonc
// double_frag
{ "multiplier": 2 }
// up_rotation
{ "poolId": "a1_genshin_v1", "upItemIds": ["genshin_zhongli"], "bannerTitle": "岩王帝君·限定祈愿" }
// festival_daily
{ "dailyRewards": { "wish_stone": 15, "stone": 2 } }   // 整包覆盖 REWARDS
// festival_quest
{ "quests": [ { "questId":"f_spring_draw", "event":"draw", "target":20,
                "reward": { "wish_stone": 10 }, "days": 7 } ] }
// tower_boost
{ "extraChallenges": 2, "firstClearBonus": 1 }
```

读取路径：`getActiveEvent(db, type)` → KV 缓存 60s（与排行榜 KV 同模式）→ 服务端各结算点读活动配置应用系数。**运营改活动 = 改 D1 events 行（wrangler d1 execute / 后台页）**，60s 内全端生效；误配置置 `status='aborted'` 秒级回滚。

## 3. 与任务系统的联动（festival_quest）

- 活动任务复用 quests-spec 的 `quest_progress` 表，`period_key = 'E:{eventId}'`。
- 活动任务**独立 tab** 展示，不挤占常驻每日任务栏（认知隔离）。
- 活动结束后未领取奖励有 48h 补领窗口 [PLACEHOLDER]，过期清 key 归档。

## 4. 客户端 / 服务端分工

- **服务端**：活动判定（当前生效活动、系数应用）在 draw/daily/tower/quests 各结算点内联执行——**客户端传来的任何"活动加成"参数一律忽略**，活动上下文永远服务端自查。
- **客户端**：`GET /api/events` 拉当前+预告活动渲染 banner/倒计时；结算页展示活动加成（"双倍碎片周 +80"）只作展示，数值以响应为准。

## 5. 奖励克制原则（延续零毒性设计）

1. **不发硬通货**：活动产出限 `wish_stone/chest_key/machine_coin/dust/fragments` 与**小额** stone（节日签到 stone 1→2 级别，非发放式堆量）；**绝不直发 UR/SSR 卡**、不做活动限定卡（保持"UR 只来自保底/兑换"的收集纯度，gdd-03 长线追逐不被活动稀释）。
2. **加成不做乘法堆叠**：double_frag 只乘碎片单一资源；同一活动档期内不叠加多种资源加成。
3. **不上强度**：所有活动可完成性只依赖既有日常动作量（抽卡/塔/签到），不要求新增在线时长。
4. **不制造错过焦虑**：日历提前 7 天在 /api/events 预告；double_frag 是月常驻骨架而非稀缺事件，玩家形成稳定预期。

## 6. API 设计

### GET /api/events（authMiddleware）
```json
{ "active":   [ { "id":"evt_202602_a", "type":"double_frag", "title":"双倍碎片周",
                  "startAt":1738368000000, "endAt":1738972800000,
                  "payload": { "multiplier": 2 } } ],
  "upcoming": [ { "...同结构，startAt 在未来 7 天内" } ] }
```
活动生效逻辑不靠此端点——各结算 handler 内部调 `getActiveEvent`（KV 缓存），本端点仅供 UI。

## 7. 边缘情况

1. **活动窗口边界请求**：`start_at`/`end_at` 用毫秒时间戳比较，结算瞬间跨界以服务端时钟为准；KV 缓存 60s 造成的边界误差 ≤1 分钟，可接受（写入成本换读取延迟）。
2. **活动重叠误配**：同 type 两行 active → 服务端取 `start_at` 最新一行并在日志告警；写入侧加校验（新增 active 行前 abort 同 type 旧行）。
3. **payload 非法**（如 multiplier=0/字符串）：各结算点对系数做范围 clamp（double_frag multiplier ∈ [1,3] 硬编码护栏），非法值按 1 处理并告警。
4. **festival_daily 与签到同请求竞态**：签到 handler 读活动配置与发奖在同一个 `saveUser` 事务内完成，读到的活动版本即结算版本。
5. **活动期改配置**（如提前 abort）：已按旧配置入账的资源**不回收**（追溯成本>损失，且全部是小额资源）；仅后续请求走新配置。

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 运营手滑写错奖励/时间 | payload 护栏 clamp（§7.3）+ status 秒级熔断 + 上线前 dry-run 校验脚本（wrangler d1 execute --local） |
| double_frag 期间碎片通胀 → 升星加速 → power 通胀 | 双倍仅 1 周/月且只作用重复卡转化（供给上限=当周抽卡量），量级可控；总览 §3.4 监控升星间隔中位数联动观察 |
| UP 轮换文案歧义引发投诉（保底继承规则误解） | **2026-09 拍板定稿**：pity 计数跨轮换继承不重置；banner 页固定展示"本期 UP：X｜大保底状态：继承（跨期不重置）"；ratePublic notes 同步写明；该承诺上线后不可回收，写入用户可见规则页 |
| 活动依赖 KV，KV 故障 | KV miss 时直查 D1（降级路径），活动判定不因 KV 不可用而中断 |
