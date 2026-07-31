/**
 * 统一掷骰引擎（小程序 Mock 与云函数共用逻辑）
 * 输入 pool 配置 + pity 状态，输出掉落与更新后的 pity
 */

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function ensurePity(pityState, pool) {
  const next = pityState ? clone(pityState) : {};
  const rarities = pool.rarities || [];
  rarities.forEach((r) => {
    if (r.hardPity || r.softPityStart) {
      const key = `hard_${r.id.toLowerCase()}`;
      if (typeof next[key] !== "number") next[key] = 0;
    }
  });
  if (pool.up && pool.up.enabled) {
    const k = pool.up.loseStreakKey || "up_lose";
    if (typeof next[k] !== "number") next[k] = 0;
  }
  return next;
}

function weightedPick(items, rand) {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let roll = rand() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= items[i].weight;
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

function buildRarityWeights(pool, pity) {
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

function pickItemFromRarity(pool, rarityId, pity, rand) {
  const table = (pool.lootTables && pool.lootTables[rarityId]) || [];
  if (!table.length) {
    return {
      itemId: `${rarityId.toLowerCase()}_generic`,
      name: `${rarityId} 物品`,
      rarity: rarityId,
    };
  }

  let candidates = table.map((t) => ({ ...t, weight: t.weight || 1 }));

  if (pool.up && pool.up.enabled && rarityId === (pool.up.rarity || "SSR")) {
    const upIds = pool.up.itemIds || [];
    const loseKey = pool.up.loseStreakKey || "up_lose";
    const forceUp =
      (pity[loseKey] || 0) >= (pool.up.maxLoseThenGuaranteed || 1);

    if (forceUp && upIds.length) {
      candidates = candidates.filter((c) => upIds.includes(c.itemId));
    } else if (upIds.length && typeof pool.up.ssrUpRate === "number") {
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

function applyPityAfterDraw(pool, pity, rarityId, item) {
  const next = clone(pity);
  (pool.rarities || []).forEach((r) => {
    const key = `hard_${r.id.toLowerCase()}`;
    if (!(r.hardPity || r.softPityStart)) return;
    if (rarityId === r.id) next[key] = 0;
    else if (typeof next[key] === "number") next[key] += 1;
  });

  if (pool.up && pool.up.enabled && rarityId === (pool.up.rarity || "SSR")) {
    const loseKey = pool.up.loseStreakKey || "up_lose";
    if (item.isUp) next[loseKey] = 0;
    else next[loseKey] = (next[loseKey] || 0) + 1;
  }
  return next;
}

function createRng(seed) {
  if (seed == null) {
    return () => Math.random();
  }
  let s = seed >>> 0;
  return function rng() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * @param {object} pool pool config
 * @param {object} pityState
 * @param {number} times
 * @param {{seed?: number, rand?: function}} options
 */
function roll(pool, pityState, times, options) {
  const rand = options && options.rand ? options.rand : createRng(options && options.seed);
  let pity = ensurePity(pityState, pool);
  const results = [];

  for (let i = 0; i < times; i++) {
    let rarityId;

    if (pool.sceneType === "C2" && pool.sectors) {
      const sector = weightedPick(
        pool.sectors.map((s) => ({ ...s, weight: s.weight })),
        rand
      );
      rarityId = sector.rarity || "R";
      const item = {
        itemId: sector.itemId,
        name: sector.name || sector.itemId,
        rarity: rarityId,
        sectorId: sector.id,
      };
      pity = applyPityAfterDraw(pool, pity, rarityId, item);
      results.push({ ...item, index: i });
      continue;
    }

    if (pool.sceneType === "B1" && pool.chestTier) {
      const table = pool.lootTables[pool.chestTier] || pool.lootTables.default || [];
      const picked = weightedPick(
        table.map((t) => ({ ...t, weight: t.weight || 1 })),
        rand
      );
      const item = {
        itemId: picked.itemId,
        name: picked.name || picked.itemId,
        rarity: picked.rarity || "R",
        chestTier: pool.chestTier,
      };
      results.push({ ...item, index: i });
      continue;
    }

    const weights = buildRarityWeights(pool, pity);
    const rarity = weightedPick(weights, rand);
    rarityId = rarity.id;

    // 十连保底：最后一抽若尚未抽到目标稀有及以上，则抬到保底档
    if (
      times >= 10 &&
      i === times - 1 &&
      pool.multi &&
      pool.multi.tenGuaranteeRarity
    ) {
      const need = pool.multi.tenGuaranteeRarity;
      const order = (pool.rarities || []).map((r) => r.id);
      const rank = (id) => order.indexOf(id);
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

module.exports = {
  roll,
  ensurePity,
  createRng,
  weightedPick,
};
