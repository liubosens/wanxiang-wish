import * as save from '../core/save.js';
import * as api from '../core/api.js';
import { getPool, POOLS } from '../core/pools.js';
import { go } from '../core/router.js';
import { esc, toast } from '../core/ui.js';

function bannerPools() {
  return Object.keys(POOLS).filter((id) => POOLS[id].presentation === 'banner');
}

// 从卡池配置动态推导保底进度文案，避免把 90 这个数字写死。
function pityText(pool, pity) {
  const parts = [];
  (pool.rarities || []).forEach((r) => {
    if (!r.hardPity) return;
    const count = pity[`hard_${r.id.toLowerCase()}`] || 0;
    parts.push(`距 ${r.id} 保底 ${Math.max(0, r.hardPity - count)} 抽`);
  });
  return parts.join(' · ') || '该卡池无硬保底';
}

export async function bannerView(root, params) {
  const ids = bannerPools();
  let poolId = params.get('poolId');
  if (!ids.includes(poolId)) poolId = ids[0];

  let results = [];
  let drawing = false;

  async function doDraw(times) {
    if (drawing) return;
    drawing = true;
    paint();
    try {
      const res = await api.draw({ poolId, times });
      results = res.results || [];
    } catch (e) {
      toast(e.message || '抽卡失败');
    } finally {
      drawing = false;
      paint();
    }
  }

  function paint() {
    const pool = getPool(poolId);
    const data = save.getSave();
    const pity = data.pity[poolId] || {};
    const item = pool.cost.itemId;
    const unit = pool.cost.amount || 1;
    const balance = data.wallet[item] || 0;

    root.innerHTML = `
      <div class="card">
        ${
          ids.length > 1
            ? `<select id="pool-pick">
                 ${ids
                   .map(
                     (id) =>
                       `<option value="${id}" ${id === poolId ? 'selected' : ''}>${esc(
                         POOLS[id].name,
                       )}</option>`,
                   )
                   .join('')}
               </select>`
            : `<div class="title">${esc(pool.name)}</div>`
        }
        <div class="muted" style="margin-top:10px">${esc(pityText(pool, pity))}</div>
        <div class="muted">余额：${esc(api.currencyLabel(item))} ${balance}</div>
        <div class="actions">
          <button class="btn-primary btn-sm" data-act="one" ${
            drawing || balance < unit ? 'disabled' : ''
          }>单抽</button>
          <button class="btn-primary btn-sm" data-act="ten" ${
            drawing || balance < unit * 10 ? 'disabled' : ''
          }>十连</button>
          <button class="btn-ghost btn-sm" data-act="rates">公示</button>
        </div>
        <div class="muted small" style="margin-top:8px">
          单抽消耗 ${esc(api.currencyLabel(item))} ×${unit} ｜ 十连 ×${unit * 10}
        </div>
      </div>

      ${
        results.length
          ? `<div class="card">
               <div class="title">本次结果</div>
               <div class="rows">
                 ${results
                   .map(
                     (r, i) => `
                   <div class="result-row" style="animation-delay:${i * 45}ms">
                     <span class="rarity-${esc(r.rarity)}">[${esc(r.rarity)}]</span>
                     <span class="name">${esc(r.name)}</span>
                     ${r.isUp ? '<span class="badge">UP</span>' : ''}
                   </div>`,
                   )
                   .join('')}
               </div>
             </div>`
          : ''
      }

      <button class="btn-ghost btn-block" data-act="back">返回概率馆</button>
    `;

    const pick = root.querySelector('#pool-pick');
    if (pick) {
      pick.onchange = () => {
        poolId = pick.value;
        results = [];
        go('banner', { poolId });
      };
    }
    root.querySelector('[data-act="one"]').onclick = () => doDraw(1);
    root.querySelector('[data-act="ten"]').onclick = () => doDraw(10);
    root.querySelector('[data-act="rates"]').onclick = () => go('rates', { poolId });
    root.querySelector('[data-act="back"]').onclick = () => go('gallery');
  }

  paint();
}
