import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

// 限时活动读取层（events-spec §2/§4）。数据驱动：运营改 D1 events 行，60s 内全端生效。
// KV 缓存 60s（与排行榜同模式）；KV 故障时直查 D1 降级，活动判定不中断。

export type EventType =
  | 'double_frag'
  | 'up_rotation'
  | 'festival_daily'
  | 'festival_quest'
  | 'tower_boost';

export interface GameEvent {
  id: string;
  type: EventType;
  title: string;
  startAt: number;
  endAt: number;
  payload: Record<string, unknown>;
}

interface EventRow {
  id: string;
  type: string;
  title: string;
  start_at: number;
  end_at: number;
  payload: string;
  status: string;
}

const KV_KEY = 'events:active';
const KV_TTL_SEC = 60;
const UPCOMING_WINDOW_MS = 7 * 24 * 3600 * 1000; // 提前 7 天预告（events-spec §5.4）

function toEvent(r: EventRow): GameEvent | null {
  try {
    return {
      id: r.id,
      type: r.type as EventType,
      title: r.title,
      startAt: r.start_at,
      endAt: r.end_at,
      payload: JSON.parse(r.payload) as Record<string, unknown>,
    };
  } catch {
    return null; // payload 非法：跳过该行（events-spec §7.3 护栏）
  }
}

async function queryActiveFromD1(db: D1Database, now: number): Promise<GameEvent[]> {
  const res = await db
    .prepare(
      `SELECT * FROM events WHERE status = 'active' AND start_at <= ? AND end_at > ? ORDER BY start_at DESC`,
    )
    .bind(now, now)
    .all<EventRow>();
  return (res.results || []).map(toEvent).filter((e): e is GameEvent => e !== null);
}

// 当前生效的全部活动（KV 60s 缓存；kv 缺省/KV 故障时直查 D1）。
export async function getActiveEvents(
  db: D1Database,
  kv?: KVNamespace,
  now = Date.now(),
): Promise<GameEvent[]> {
  if (kv) {
    try {
      const cached = await kv.get(KV_KEY, 'json');
      if (Array.isArray(cached)) return cached as GameEvent[];
    } catch {
      // KV 故障降级 D1（events-spec §8）
    }
  }
  const events = await queryActiveFromD1(db, now);
  if (kv) {
    try {
      await kv.put(KV_KEY, JSON.stringify(events), { expirationTtl: KV_TTL_SEC });
    } catch {
      // 写缓存失败不影响主流程
    }
  }
  return events;
}

// 某类型的当前生效活动（同 type 多行取 start_at 最新——events-spec §7.2）。
export async function getActiveEvent(
  db: D1Database,
  type: EventType,
  kv?: KVNamespace,
  now = Date.now(),
): Promise<GameEvent | null> {
  const active = await getActiveEvents(db, kv, now);
  return active.find((e) => e.type === type) ?? null;
}

// GET /api/events 用：生效中 + 未来 7 天预告。
export async function getEventsForDisplay(
  db: D1Database,
  kv?: KVNamespace,
  now = Date.now(),
) {
  const active = await getActiveEvents(db, kv, now);
  const res = await db
    .prepare(
      `SELECT * FROM events WHERE status = 'active' AND start_at > ? AND start_at <= ? ORDER BY start_at ASC`,
    )
    .bind(now, now + UPCOMING_WINDOW_MS)
    .all<EventRow>();
  const upcoming = (res.results || []).map(toEvent).filter((e): e is GameEvent => e !== null);
  return { active, upcoming };
}

// ---- 结算点系数护栏（events-spec §7.3：非法值按安全默认处理） ----

// double_frag：碎片倍率 clamp 到 [1,3]，非法按 1。
export function fragMultiplier(ev: GameEvent | null): number {
  const m = Number(ev?.payload?.multiplier);
  if (!ev || !Number.isFinite(m)) return 1;
  return Math.min(3, Math.max(1, Math.floor(m)));
}

// tower_boost：额外挑战次数 clamp 到 [0,5]，首通奖励加成 clamp 到 [0,2]。
export function towerBoost(ev: GameEvent | null): { extraChallenges: number; firstClearBonus: number } {
  if (!ev) return { extraChallenges: 0, firstClearBonus: 0 };
  const ec = Number(ev.payload?.extraChallenges);
  const fb = Number(ev.payload?.firstClearBonus);
  return {
    extraChallenges: Number.isFinite(ec) ? Math.min(5, Math.max(0, Math.floor(ec))) : 0,
    firstClearBonus: Number.isFinite(fb) ? Math.min(2, Math.max(0, Math.floor(fb))) : 0,
  };
}
