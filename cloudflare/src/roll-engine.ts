// 统一掷骰引擎 - 移植自 cloudfunctions/draw/roll-engine.js
// 关键变更：createRng() 在无 seed 时使用 crypto.getRandomValues 派生 [0,1) 随机源，
// 取代原 Math.random()，保证抽卡结果由服务端权威决定，客户端不可预测/不可影响。

export interface RarityDef {
  id: string;
  weight: number;
  softPityStart?: number;
  softPityStep?: number;
  hardPity?: number;
}

export interface UpDef {
  enabled: boolean;
  rarity?: string;
  loseStreakKey?: string;
  maxLoseThenGuaranteed?: number;
  ssrUpRate?: number;
  itemIds?: string[];
}

export interface LootEntry {
  itemId: string;
  name?: string;
  weight?: number;
  rarity?: string;
}

export interface SectorDef {
  id: string;
  itemId: string;
  name?: string;
  rarity: string;
  weight: number;
}

export interface Pool {
  poolId: string;
  name: string;
  sceneType?: string;
  presentation?: string;
  cost: { itemId: string; amount: number };
  multi?: { ten?: boolean; tenCost?: number; tenGuaranteeRarity?: string };
  rarities?: RarityDef[];
  up?: UpDef;
  lootTables?: Record<string, LootEntry[]>;
  sectors?: SectorDef[];
  chestTier?: string;
  serverPity?: { enabled: boolean; threshold: number; rewardRarity: string };
  pointsPerDraw?: number;
  exchange?: { itemId: string; name: string; cost: number };
  ratePublic?: Record<string, unknown>;
}

export type Pity = Record<string, number>;

export interface DrawItem {
  itemId: string;
  name: string;
  rarity: string;
  isUp?: boolean;
}

export interface DrawResult extends DrawItem {
  index: number;
  sectorId?: string;
  chestTier?: string;
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function ensurePity(pityState: Pity | null, pool: Pool): Pity {
  const next: Pity = pityState ? clone(pityState) : {};
  const rarities = pool.rarities || [];
  rarities.forEach((r) => {
    if (r.hardPity || r.softPityStart) {
      const key = `hard_${r.id.toLowerCase()}`;
      if (typeof next[key] !== 'number') next[key] = 0;
    }
  });
  if (pool.up && pool.up.enabled) {
    const k = pool.up.loseStreakKey || 'up_lose';
    if (typeof next[k] !== 'number') next[k] = 0;
  }
  return next;
}

function weightedPick<T extends { weight: number }>(items: T[], rand: () => number): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let roll = rand() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= items[i].weight;
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

function buildRarityWeights(pool: Pool, pity: Pity) {
  return (pool.rarities || []).map((r) => {
    let weight = r.weight;
    const pityKey = `hard_${r.id.toLowerCase()}`;
    const count = pity[pityKey] || 0;
    if (r.softPityStart && count + 1 >= r.softPityStart) {
      const steps = count + 1 - r.softPityStart + 1;
      weight = weight + steps * (r.softPityStep || weight);
    }
    if (r.hardPity && count + 1 >= r.hardPity) {
      weight = weight + 1e12;
    }
    return { id: r.id, weight, meta: r };
  });
}

function pickItemFromRarity(
  pool: Pool,
  rarityId: string,
  pity: Pity,
  rand: () => number,
): DrawItem {
  const table = (pool.lootTables && pool.lootTables[rarityId]) || [];
  if (!table.length) {
    return {
      itemId: `${rarityId.toLowerCase()}_generic`,
      name: `${rarityId} 物品`,
      rarity: rarityId,
    };
  }

  let candidates = table.map((t) => ({ ...t, weight: t.weight || 1 }));

  if (pool.up && pool.up.enabled && rarityId === (pool.up.rarity || 'SSR')) {
    const upIds = pool.up.itemIds || [];
    const loseKey = pool.up.loseStreakKey || 'up_lose';
    const forceUp = (pity[loseKey] || 0) >= (pool.up.maxLoseThenGuaranteed || 1);

    if (forceUp && upIds.length) {
      candidates = candidates.filter((c) => upIds.includes(c.itemId));
    } else if (upIds.length && typeof pool.up.ssrUpRate === 'number') {
      if (rand() < pool.up.ssrUpRate) {
        const upOnly = candidates.filter((c) => upIds.includes(c.itemId));
        if (upOnly.length) candidates = upOnly;
      } else {
        const nonUp = candidates.filter((c) => !upIds.includes(c.itemId));
        if (nonUp.length) candidates = nonUp;
      }
    }
  }

  const picked = weightedPick(candidates, rand);
  return {
    itemId: picked.itemId,
    name: picked.name || picked.itemId,
    rarity: rarityId,
    isUp: !!(pool.up && (pool.up.itemIds || []).includes(picked.itemId)),
  };
}

function applyPityAfterDraw(pool: Pool, pity: Pity, rarityId: string, item: DrawItem): Pity {
  const next = clone(pity);
  (pool.rarities || []).forEach((r) => {
    const key = `hard_${r.id.toLowerCase()}`;
    if (!(r.hardPity || r.softPityStart)) return;
    if (rarityId === r.id) next[key] = 0;
    else if (typeof next[key] === 'number') next[key] += 1;
  });

  if (pool.up && pool.up.enabled && rarityId === (pool.up.rarity || 'SSR')) {
    const loseKey = pool.up.loseStreakKey || 'up_lose';
    if (item.isUp) next[loseKey] = 0;
    else next[loseKey] = (next[loseKey] || 0) + 1;
  }
  return next;
}

export function createRng(seed?: number): () => number {
  if (seed == null) {
    // Server-authoritative randomness: derive [0,1) from a 32-bit crypto value.
    return () => {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] / 0x100000000;
    };
  }
  // Deterministic LCG kept for reproducible tests only.
  let s = seed >>> 0;
  return function rng(): number {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export interface RollOptions {
  seed?: number;
  rand?: () => number;
  forceRarity?: string;
}

export function roll(
  pool: Pool,
  pityState: Pity,
  times: number,
  options?: RollOptions,
): { results: DrawResult[]; pityState: Pity } {
  const rand = options && options.rand ? options.rand : createRng(options && options.seed);
  const forceRarity = (options && options.forceRarity) || null;
  let forceUsed = false;
  let pity = ensurePity(pityState, pool);
  const results: DrawResult[] = [];

  for (let i = 0; i < times; i++) {
    if (forceRarity && !forceUsed) {
      forceUsed = true;
      const fr = forceRarity;
      const fitem = pickItemFromRarity(pool, fr, pity, rand);
      pity = applyPityAfterDraw(pool, pity, fr, fitem);
      results.push({ ...fitem, index: i });
      continue;
    }

    let rarityId: string;

    if (pool.sceneType === 'C2' && pool.sectors) {
      const sector = weightedPick(
        pool.sectors.map((s) => ({ ...s, weight: s.weight })),
        rand,
      );
      rarityId = sector.rarity || 'R';
      const item: DrawItem = {
        itemId: sector.itemId,
        name: sector.name || sector.itemId,
        rarity: rarityId,
      };
      pity = applyPityAfterDraw(pool, pity, rarityId, item);
      results.push({ ...item, index: i, sectorId: sector.id });
      continue;
    }

    if (pool.sceneType === 'B1' && pool.chestTier) {
      const table = pool.lootTables?.[pool.chestTier] || pool.lootTables?.default || [];
      const picked = weightedPick(
        table.map((t) => ({ ...t, weight: t.weight || 1 })),
        rand,
      );
      const item: DrawItem = {
        itemId: picked.itemId,
        name: picked.name || picked.itemId,
        rarity: picked.rarity || 'R',
      };
      results.push({ ...item, index: i, chestTier: pool.chestTier });
      continue;
    }

    const weights = buildRarityWeights(pool, pity);
    const rarity = weightedPick(weights, rand);
    rarityId = rarity.id;

    // Ten-pull floor: last pull is lifted to the guaranteed rarity if none reached it yet.
    if (
      times >= 10 &&
      i === times - 1 &&
      pool.multi &&
      pool.multi.tenGuaranteeRarity
    ) {
      const need = pool.multi.tenGuaranteeRarity;
      const order = (pool.rarities || []).map((r) => r.id);
      const rank = (id: string) => order.indexOf(id);
      const needRank = rank(need);
      const ok = results.some((r) => {
        const rr = rank(r.rarity);
        return rr !== -1 && needRank !== -1 && rr <= needRank;
      });
      if (!ok && needRank !== -1 && (rank(rarityId) === -1 || rank(rarityId) > needRank)) {
        rarityId = need;
      }
    }

    const item = pickItemFromRarity(pool, rarityId, pity, rand);
    pity = applyPityAfterDraw(pool, pity, rarityId, item);
    results.push({ ...item, index: i });
  }

  return { results, pityState: pity };
}
