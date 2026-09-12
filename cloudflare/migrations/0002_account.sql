-- 账号系统扩展：头像、统计计数、每日签到时间
-- 对应「增强版账号系统」。SQLite 的 ADD COLUMN 带 NOT NULL 时必须给默认值。

ALTER TABLE users ADD COLUMN avatar TEXT;
ALTER TABLE users ADD COLUMN total_draws INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN pk_win INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN pk_lose INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_daily_at TEXT;

-- 昵称唯一性校验走精确匹配，建索引加速（昵称允许 NULL，SQLite 唯一索引不冲突多个 NULL）。
CREATE INDEX IF NOT EXISTS idx_users_nick_name ON users(nick_name);
