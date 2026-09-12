# 万象祈愿 · 任务/成就系统 规格（Phase 5 拓展 · design-strategist 交付）

> 日常回流引擎 + 资源地板。产出 `wish_stone` 为主、`stone` 为辅。
> 所有数值 [PLACEHOLDER]，需按目标日活时长校准。

## 1. 机制定义

### 1.1 每日任务（4 条，UTC+8 自然日重置，与 `daily.ts` 的 `todayCN()` 同口径）

| ID | 任务 | 目标 | 奖励 [PLACEHOLDER] |
|---|---|---|---|
| `d_draw10` | 抽卡 10 次（任意池，单抽/十连都计数） | 10 | wish_stone ×5 |
| `d_tower1` | 试炼塔挑战 1 次 | 1 | chest_key ×1 |
| `d_pk3` | 参与 PK 3 次（不论胜负） | 3 | machine_coin ×3 |
| `d_upgrade1` | 升星 1 次 | 1 | dust ×30 |
| 全勤宝箱 | 上述 4 条全部领取后开启 | — | **stone ×1** + wish_stone ×5 |

> 设计理由：单条任务发小货币维持日常动力，**stone 只进全勤宝箱**——把进阶石地板与"完成全部日常"绑定，控制供给节奏（总览 §3.2 的 `S_dailyBox` 唯一来源）。

### 1.2 每周任务（3 条，周一 00:00 UTC+8 重置）

| ID | 任务 | 目标 | 奖励 [PLACEHOLDER] |
|---|---|---|---|
| `w_draw70` | 累计抽卡 70 次 | 70 | wish_stone ×15 |
| `w_tower15` | 试炼塔累计挑战成功 15 层次 | 15 | **stone ×2** |
| `w_pk10` | PK 累计获胜 10 场 | 10 | chest_key ×3 |

### 1.3 成就树（一次性，按世界分组 + 通用组）

每个世界一组、每组 3 层深度（收集 → 强化 → 极致），全部一次性奖励：

- **收集层**：该世界图鉴收集达 6 / 10 / 12 张 → stone ×3 / ×5 / ×10 [PLACEHOLDER]
- **强化层**：该世界任意卡升到 3 / 5 星 → stone ×5 / ×15 [PLACEHOLDER]
- **极致层**：该世界 UR 收集 ≥1 / ≥2 → wish_stone ×30 + 头像框标识（荣誉向，非资源）
- **通用组**：累计抽卡 100/500/2000、总战力达 300/600/900、全服保底触发亲历 1 次 → wish_stone / dust 阶梯

成就奖励以 stone 一次性大额为主——这是回流玩家的"追赶包"，边际递减（越往后越偏荣誉）。

## 2. 数据模型（D1）

任务**定义**走配置（数据驱动，与 events-spec 共用机制），**进度**走表：

```sql
-- 0003_expansion.sql 片段
CREATE TABLE IF NOT EXISTS quest_progress (
  openid      TEXT NOT NULL,
  quest_id    TEXT NOT NULL,      -- 如 d_draw10 / w_tower15 / ach_genshin_collect_6
  period_key  TEXT NOT NULL,      -- 'D:2026-02-08' | 'W:2026-W06' | 'A'（成就一次性）
  progress    INTEGER NOT NULL DEFAULT 0,
  claimed     INTEGER NOT NULL DEFAULT 0,   -- 0/1，幂等领取位
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (openid, quest_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_quest_progress_openid ON quest_progress(openid, period_key);
```

任务定义 JSON（服务端常量或 D1 `quest_defs` 表，供活动扩展热插）：

```json
{
  "questId": "d_draw10",
  "type": "daily", "event": "draw", "target": 10,
  "reward": { "wish_stone": 5 },
  "sort": 1
}
```

`event` 枚举：`draw / upgrade / pk_attempt / pk_win / tower_challenge / tower_clear / exchange`。新增玩法只需挂新事件名。

## 3. 客户端 / 服务端分工

- **服务端（唯一真相源）**：进度计数、达标判定、领奖发放、周期切 key。客户端上报的任何进度数字一律忽略。
- **客户端**：只读展示（任务列表、进度条、可领红点），领奖时调 `POST /api/quests/claim` 并以响应中的 wallet/power 为准刷新本地。

## 4. API 设计（沿用 Bearer JWT + /api/* 风格）

### GET /api/quests
响应：
```json
{
  "periodKey": { "daily": "D:2026-02-08", "weekly": "W:2026-W06" },
  "daily":   [ { "questId":"d_draw10", "target":10, "progress":7, "claimed":false, "reward":{...} } ],
  "weekly":  [ ... ],
  "achievements": [ { "questId":"ach_genshin_collect_6", "target":6, "progress":4, "claimed":false } ],
  "dailyBoxClaimed": false
}
```

### POST /api/quests/claim
请求 `{ "questId": "d_draw10" }`（全勤宝箱用 `questId: "d_daily_box"`）。
服务端流程（单事务思路，参照 `db.batch` 用法）：
1. 读 `quest_progress`，校验 `progress ≥ target && claimed = 0`；
2. 置 `claimed = 1`，发奖励入 wallet，`saveUser`；
3. 若为成就，同时回写 codex/成就展示字段。
幂等：`claimed` 位即幂等锁，重复请求返回 409 或直接返回当前态（推荐后者，弱网重试友好）。

## 5. 防刷与边缘情况

- **"抽卡 10 次"计数**：只由 `services/draw.ts` 在事务内 `bumpQuestProgress(openid, 'draw', times)`，客户端不可伪造；十连按 `times=10` 一次累加。
- **PK 计数**：`pk_attempt` 每次 `/api/pk` +1（含负），`pk_win` 仅胜利 +1——挂机刷负场不亏也不赚（超奖励上限后 PK 仍计数任务，见总览 §5 封顶说明）。
- **试炼塔计数**：`tower_challenge` 每次挑战 +1（消耗次数的才计），`tower_clear` 每首次通过新层 +1，扫荡不计。
- **周期切换竞态**：`period_key` 由服务端 `todayCN()`/ISO 周生成，跨零点瞬间的前一请求落入旧 key，不丢单、不重复（不同 key 天然隔离）。
- **改时区/改设备**：进度在服务端，与设备无关。
- **全勤宝箱**：判定 = 当日 4 条 daily 均 `claimed=1`；用独立行 `d_daily_box` 存领取位。
- **成就跨版本新增任务**：新 quest_id 首次出现时 progress 从当前存量重算（如"收集 6 张"上线时直接按 codex 现状初始化），由服务端在读取时惰性补算，无需回填脚本。

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 每日任务逼迫全类型玩法 → 休闲玩家负担 | 4 条全部低门槛（10 抽约 2 分钟）；试炼塔/PK 任务目标量取最低有效值 |
| stone 经全勤宝箱+周任务月供 ~28，仍偏高/偏低 | 两处均为单点常量，playtest 后一键调（总览 §3.3 调参顺序） |
| quest_progress 表膨胀（每用户每日 5 行） | 行级小、按 `(openid, period_key)` 索引可分区清理；保留 90 天内 daily 周期行，更早的归档删除（D1 cron trigger） |
| 活动期附加任务与常驻任务冲突 | 活动任务独立 `type: "event"` + 独立 period_key，UI 分 tab，互不挤占（见 events-spec §3） |
