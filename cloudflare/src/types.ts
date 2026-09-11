import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

// Workers bindings. Injected by wrangler.toml (DB / KV) and runtime (.dev.vars / secret).
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
}

// Hono app environment: bindings + per-request variables set by auth middleware.
export type AppEnv = {
  Bindings: Env;
  Variables: { openid: string };
};

export type Wallet = Record<string, number>;
export type Pity = Record<string, number>;

export interface InventoryItem {
  count: number;
  rarity: string;
  star: number;
  name: string;
}
export type Inventory = Record<string, InventoryItem>;

export interface CodexEntry {
  firstAt: number;
  rarity: string;
  name: string;
}
export type Codex = Record<string, CodexEntry>;

export interface User {
  openid: string;
  nick_name: string | null;
  wallet: Wallet;
  inventory: Inventory;
  codex: Codex;
  pity: Pity;
  power: number;
  created_at: number;
  updated_at: number;
}

export interface LeaderboardRow {
  rank: number;
  id: string;
  name: string;
  power: number;
  isMe: boolean;
}
