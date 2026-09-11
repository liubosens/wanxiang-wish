-- 万象祈愿 初始化表结构 (D1 / SQLite)
-- 对应 Spec 第 6 节。wallet/inventory/codex/pity 以 JSON 文本存储，沿用原结构。

CREATE TABLE IF NOT EXISTS users (
  openid     TEXT PRIMARY KEY,
  nick_name  TEXT,
  wallet     TEXT NOT NULL,
  inventory  TEXT NOT NULL,
  codex      TEXT NOT NULL,
  pity       TEXT NOT NULL,
  power      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS server_pity (
  pool_id TEXT PRIMARY KEY,
  count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS draw_tokens (
  token  TEXT PRIMARY KEY,
  openid TEXT NOT NULL,
  at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  openid   TEXT NOT NULL,
  pool_id  TEXT NOT NULL,
  pool_name TEXT NOT NULL,
  item_id  TEXT NOT NULL,
  name     TEXT NOT NULL,
  rarity   TEXT NOT NULL,
  at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_openid_at ON history(openid, at DESC);
CREATE INDEX IF NOT EXISTS idx_draw_tokens_openid ON draw_tokens(openid);
CREATE INDEX IF NOT EXISTS idx_server_pity_pool ON server_pity(pool_id);
