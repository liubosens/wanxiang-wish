import type { D1Database } from '@cloudflare/workers-types';
import type { User, Wallet, Inventory, Codex, Pity } from './types';

// Repository layer: all D1 access goes through here. Handlers never write SQL.

export function getInitialWallet(): Wallet {
  // 与 miniprogram/utils/save.js 的 DEFAULT 钱包保持一致。
  // point_wz 供 C2 荣耀积分兑换；fragments/stone 供升星链路使用。
  return {
    dust: 100,
    wish_stone: 60,
    chest_key: 15,
    machine_coin: 20,
    point_wz: 0,
    fragments: 0,
    stone: 3,
  };
}

interface UserRow {
  openid: string;
  nick_name: string | null;
  avatar: string | null;
  wallet: string;
  inventory: string;
  codex: string;
  pity: string;
  power: number;
  total_draws: number;
  pk_win: number;
  pk_lose: number;
  last_daily_at: string | null;
  created_at: number;
  updated_at: number;
}

export function parseUser(row: UserRow): User {
  return {
    openid: row.openid,
    nick_name: row.nick_name,
    avatar: row.avatar,
    wallet: JSON.parse(row.wallet) as Wallet,
    inventory: JSON.parse(row.inventory) as Inventory,
    codex: JSON.parse(row.codex) as Codex,
    pity: JSON.parse(row.pity) as Pity,
    power: row.power,
    total_draws: row.total_draws || 0,
    pk_win: row.pk_win || 0,
    pk_lose: row.pk_lose || 0,
    last_daily_at: row.last_daily_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getUser(db: D1Database, openid: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM users WHERE openid = ?')
    .bind(openid)
    .first<UserRow>();
  return row ? parseUser(row) : null;
}

export async function createUser(
  db: D1Database,
  openid: string,
  nickName: string | null,
): Promise<User> {
  const now = Date.now();
  const user: User = {
    openid,
    nick_name: nickName,
    avatar: null,
    wallet: getInitialWallet(),
    inventory: {},
    codex: {},
    pity: {},
    power: 0,
    total_draws: 0,
    pk_win: 0,
    pk_lose: 0,
    last_daily_at: null,
    created_at: now,
    updated_at: now,
  };
  await db
    .prepare(
      `INSERT INTO users
        (openid, nick_name, avatar, wallet, inventory, codex, pity, power,
         total_draws, pk_win, pk_lose, last_daily_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      openid,
      nickName,
      user.avatar,
      JSON.stringify(user.wallet),
      JSON.stringify(user.inventory),
      JSON.stringify(user.codex),
      JSON.stringify(user.pity),
      0,
      0,
      0,
      0,
      null,
      now,
      now,
    )
    .run();
  return user;
}

export async function saveUser(db: D1Database, user: User): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET
         nick_name=?, avatar=?, wallet=?, inventory=?, codex=?, pity=?, power=?,
         total_draws=?, pk_win=?, pk_lose=?, last_daily_at=?, updated_at=?
       WHERE openid=?`,
    )
    .bind(
      user.nick_name,
      user.avatar,
      JSON.stringify(user.wallet),
      JSON.stringify(user.inventory),
      JSON.stringify(user.codex),
      JSON.stringify(user.pity),
      user.power,
      user.total_draws || 0,
      user.pk_win || 0,
      user.pk_lose || 0,
      user.last_daily_at ?? null,
      user.updated_at,
      user.openid,
    )
    .run();
}

// 昵称唯一性：忽略大小写与首尾空格做精确匹配，排除自己。
export async function findOtherUserByNickname(
  db: D1Database,
  nickName: string,
  exceptOpenid: string,
): Promise<{ openid: string } | null> {
  const row = await db
    .prepare('SELECT openid FROM users WHERE nick_name = ? COLLATE NOCASE AND openid <> ? LIMIT 1')
    .bind(nickName, exceptOpenid)
    .first<{ openid: string }>();
  return row ?? null;
}

// 账号注销：清空该用户的档案、抽卡记录与幂等 token（排行榜快照由调用方另行失效）。
export async function deleteUser(db: D1Database, openid: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM users WHERE openid = ?').bind(openid),
    db.prepare('DELETE FROM history WHERE openid = ?').bind(openid),
    db.prepare('DELETE FROM draw_tokens WHERE openid = ?').bind(openid),
  ]);
}

export interface HistoryRow {
  openid: string;
  pool_id: string;
  pool_name: string;
  item_id: string;
  name: string;
  rarity: string;
  at: number;
}

export interface HistoryOut {
  item_id: string;
  name: string;
  rarity: string;
  pool_id: string;
  pool_name: string;
  at: number;
}

export async function insertHistoryBatch(db: D1Database, rows: HistoryRow[]): Promise<void> {
  if (rows.length === 0) return;
  const stmts = rows.map((r) =>
    db
      .prepare(
        'INSERT INTO history (openid, pool_id, pool_name, item_id, name, rarity, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(r.openid, r.pool_id, r.pool_name, r.item_id, r.name, r.rarity, r.at),
  );
  await db.batch(stmts);
}

export async function getHistory(
  db: D1Database,
  openid: string,
  limit: number,
): Promise<HistoryOut[]> {
  const res = await db
    .prepare(
      'SELECT item_id, name, rarity, pool_id, pool_name, at FROM history WHERE openid = ? ORDER BY at DESC LIMIT ?',
    )
    .bind(openid, limit)
    .all<HistoryOut>();
  return res.results;
}

// server_pity: global cumulative pity counter per pool (read/write server-side only).
export async function getServerPity(db: D1Database, poolId: string): Promise<number> {
  const row = await db
    .prepare('SELECT count FROM server_pity WHERE pool_id = ?')
    .bind(poolId)
    .first<{ count: number }>();
  return row ? row.count : 0;
}

export async function setServerPity(
  db: D1Database,
  poolId: string,
  count: number,
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO server_pity (pool_id, count) VALUES (?, ?) ON CONFLICT(pool_id) DO UPDATE SET count = ?',
    )
    .bind(poolId, count, count)
    .run();
}

// Idempotency: reject a repeated clientToken (AC-04).
export async function drawTokenExists(db: D1Database, token: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT token FROM draw_tokens WHERE token = ?')
    .bind(token)
    .first();
  return !!row;
}

export async function insertDrawToken(
  db: D1Database,
  token: string,
  openid: string,
): Promise<void> {
  await db
    .prepare('INSERT INTO draw_tokens (token, openid, at) VALUES (?, ?, ?)')
    .bind(token, openid, Date.now())
    .run();
}

export async function getLeaderboardTop(
  db: D1Database,
  limit: number,
): Promise<{ openid: string; nick_name: string | null; avatar: string | null; power: number }[]> {
  const res = await db
    .prepare('SELECT openid, nick_name, avatar, power FROM users ORDER BY power DESC LIMIT ?')
    .bind(limit)
    .all<{ openid: string; nick_name: string | null; avatar: string | null; power: number }>();
  return res.results;
}

export async function countUsersWithPowerGt(db: D1Database, power: number): Promise<number> {
  // 用严格大于：rank = count(power > 我) + 1，避免把自己算进名次（off-by-one）。
  const row = await db
    .prepare('SELECT COUNT(*) AS c FROM users WHERE power > ?')
    .bind(power)
    .first<{ c: number }>();
  return row ? row.c : 0;
}
