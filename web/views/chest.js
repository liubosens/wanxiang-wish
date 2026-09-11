import * as save from '../core/save.js';
import * as api from '../core/api.js';
import { getPool, POOLS } from '../core/pools.js';
import { go } from '../core/router.js';
import { esc, toast } from '../core/ui.js';

function chestPools() {
  return Object.keys(POOLS).filter((id) => POOLS[id].presentation === 'chest');
}

function pityText(pool, pity) {
  const parts = [];
  (pool.rarities || []).forEach((r) => {
    if (!r.hardPity) return;
    const count = pity[`hard_${r.id.toLowerCase()}`] || 0;
    parts.push(`距 ${r.id} 保底 ${Math.max(0, r.hardPity - count)} 抽`);
  });
  return parts.join(' · ');
}

export async function chestView(root, params) {
  const ids = chestPools();
  let results = [];
  let openedFrom = '';
  let drawing = false;

  async function open(poolId) {
    if (drawing) return;
    drawing = true;
    paint();
    try {
      const res = await api.draw({ poolId, times: 1 });
      results = res.results || [];
      openedFrom = poolId;
    } catch (e) {
      toast(e.message || '开启失败');
    } finally {
      drawing = false;
      paint();
    }
  }

  function paint() {
    const data = save.getSave();
    const wallet = data.wallet;

    root.innerHTML = `
      <div class="card">
        <div class="title">分级宝箱</div>
        <div class="muted">箱钥余额：${wallet.chest_key}</div>
        <div class="muted small" style="margin-top:6px">全服累积保底由服务端计数，抽满即触发。</div>
      </div>

      ${ids
        .map((id) => {
          const pool = getPool(id);
          const unit = pool.cost.amount || 1;
          const can = (wallet[pool.cost.itemId] || 0) >= unit;
          const pity = data.pity[id] || {};
          return `
            <div class="card">
              <div class="title">${esc(pool.name)}</div>
              <div class="muted">消耗 ${esc(api.currencyLabel(pool.cost.itemId))} ×${unit}</div>
              ${pityText(pool, pity) ? `<div class="muted small">${esc(pityText(pool, pity))}</div>` : ''}
              <div class="actions">
                <button class="btn-primary btn-sm" data-open="${id}" ${
                  drawing || !can ? 'disabled' : ''
                }>开启</button>
                <button class="btn-ghost btn-sm" data-rates="${id}">公示</button>
              </div>
            </div>`;
        })
        .join('')}

      ${
        results.length
          ? `<div class="card">
               <div class="title">获得</div>
               <div class="muted small">来自 ${esc(openedFrom)}</div>
               <div class="rows">
                 ${results
                   .map(
                     (r, i) => `
                   <div class="result-row" style="animation-delay:${i * 45}ms">
                     <span class="rarity-${esc(r.rarity)}">[${esc(r.rarity)}]</span>
                     <span class="name">${esc(r.name)}</span>
                   </div>`,
                   )
                   .join('')}
               </div>
             </div>`
          : ''
      }

      <button class="btn-ghost btn-block" data-act="back">返回概率馆</button>
    `;

    root.querySelectorAll('[data-open]').forEach((el) => {
      el.onclick = () => open(el.dataset.open);
    });
    root.querySelectorAll('[data-rates]').forEach((el) => {
      el.onclick = () => go('rates', { poolId: el.dataset.rates });
    });
    root.querySelector('[data-act="back"]').onclick = () => go('gallery');
  }

  paint();
}
