-- 0003_expansion.sql —— 玩法拓展（四系统）基础设施
-- 任务/成就进度表 + PK 每日奖励上限字段（2026-09 拍板修订，见 design/gdd/competitive-spec.md §7）
-- 状态：已于 2026-09-12 在远程 wanxiang-wish 执行完毕（三表两列均已生效，经 PRAGMA 核实）。
-- 注意：ALTER TABLE ADD COLUMN 在 SQLite 不支持 IF NOT EXISTS，本文件不可重复执行。

-- 任务/成就进度。计数型任务进度由服务端事务内埋点累加；状态型任务（收集/战力/星级）
-- 进度不落库，读取时从 user 档案惰性重算，本表仅存其 claimed 领取位。
CREATE TABLE IF NOT EXISTS quest_progress (
  openid      TEXT NOT NULL,
  quest_id    TEXT NOT NULL,      -- 如 d_draw10 / w_tower15 / ach_genshin_collect_6
  period_key  TEXT NOT NULL,      -- 'D:2026-09-12' | 'W:2026-W37' | 'A'（成就一次性）
  progress    INTEGER NOT NULL DEFAULT 0,
  claimed     INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (openid, quest_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_quest_progress_openid ON quest_progress(openid, period_key);

-- PK 每日奖励上限：当日已发奖胜场计数，todayCN() 切日清零（pk_reward_date <> 今日即视为 0）。
ALTER TABLE users ADD COLUMN pk_reward_date TEXT;
ALTER TABLE users ADD COLUMN pk_reward_wins INTEGER NOT NULL DEFAULT 0;

-- 试炼塔状态（trial-tower-spec §2）。best_floor 只升不降，不设赛季重置。
CREATE TABLE IF NOT EXISTS tower_state (
  openid          TEXT PRIMARY KEY,
  best_floor      INTEGER NOT NULL DEFAULT 0,   -- 已通最高层（0=未开塔）
  challenge_date  TEXT,                         -- 'YYYY-MM-DD'（UTC+8），切日重置次数
  challenges_used INTEGER NOT NULL DEFAULT 0,
  sweep_date      TEXT,                         -- 当日是否已扫荡
  updated_at      INTEGER NOT NULL
);

-- 限时活动（events-spec §2，数据驱动核心）。运营改活动 = 改本表行，60s 内全端生效，不发版。
-- payload JSON 按 type 定义 schema：
--   double_frag:     { "multiplier": 2 }
--   up_rotation:     { "poolId": "a1_genshin_v1", "upItemIds": ["genshin_zhongli"], "bannerTitle": "岩王帝君·限定祈愿" }
--   festival_daily:  { "dailyRewards": { "wish_stone": 15, "stone": 2 } }
--   festival_quest:  { "quests": [ { "questId": "f_x_draw", "title": "...", "event": "draw", "target": 20, "reward": {...} } ] }
--   tower_boost:     { "extraChallenges": 2, "firstClearBonus": 1 }
CREATE TABLE IF NOT EXISTS events (
  id        TEXT PRIMARY KEY,     -- 'evt_202609_a'
  type      TEXT NOT NULL,        -- double_frag / up_rotation / festival_daily / festival_quest / tower_boost
  title     TEXT NOT NULL,
  start_at  INTEGER NOT NULL,     -- ms 时间戳，UTC+8 语义由运营侧保证
  end_at    INTEGER NOT NULL,
  payload   TEXT NOT NULL,        -- JSON
  status    TEXT NOT NULL DEFAULT 'active'  -- active | ended | aborted（秒级熔断开关）
);
CREATE INDEX IF NOT EXISTS idx_events_window ON events(start_at, end_at);

-- 示例（按需改时间后执行）：
-- INSERT INTO events (id, type, title, start_at, end_at, payload) VALUES
--   ('evt_demo_double_frag', 'double_frag', '双倍碎片周', 1789000000000, 1789604800000, '{"multiplier":2}');
