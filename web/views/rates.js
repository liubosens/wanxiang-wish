import { listPools, getPool } from '../core/pools.js';
import { go } from '../core/router.js';
import { esc } from '../core/ui.js';

export async function ratesView(root, params) {
  const options = listPools();
  let poolId = params.get('poolId');
  if (!options.some((o) => o.poolId === poolId)) poolId = options[0].poolId;

  function paint() {
    const pool = getPool(poolId);
    const rp = (pool && pool.ratePublic) || {};

    // ratePublic 结构各池不一：字符串按行展示，数组按列表展示。
    const lines = Object.keys(rp)
      .filter((k) => k !== 'notes')
      .map((k) => {
        const v = rp[k];
        if (typeof v === 'string' || typeof v === 'number') {
          return `<div class="row between"><span class="muted">${esc(k)}</span><span>${esc(v)}</span></div>`;
        }
        return '';
      })
      .join('');

    const notes = Array.isArray(rp.notes) ? rp.notes : [];

    root.innerHTML = `
      <div class="card">
        <select id="pool-pick">
          ${options
            .map(
              (o) =>
                `<option value="${o.poolId}" ${o.poolId === poolId ? 'selected' : ''}>${esc(
                  o.name,
                )}</option>`,
            )
            .join('')}
        </select>
      </div>

      <div class="card">
        <div class="title">${esc(pool.name)}</div>
        ${
          lines
            ? `<div class="rows small">${lines}</div>`
            : '<div class="muted">该卡池未单独公示基础概率，见下方说明。</div>'
        }
        ${
          notes.length
            ? `<div class="stack" style="margin-top:12px">
                 ${notes.map((n) => `<div class="muted small">· ${esc(n)}</div>`).join('')}
               </div>`
            : ''
        }
      </div>

      <div class="card">
        <div class="title">稀有度与保底</div>
        <div class="rows small">
          ${(pool.rarities || [])
            .map(
              (r) => `
            <div class="row between">
              <span class="rarity-${esc(r.id)}">${esc(r.id)}</span>
              <span class="muted">
                权重 ${r.weight}
                ${r.softPityStart ? ` ｜ ${r.softPityStart} 抽起软保底` : ''}
                ${r.hardPity ? ` ｜ ${r.hardPity} 抽硬保底` : ''}
              </span>
            </div>`,
            )
            .join('')}
        </div>
      </div>

      <button class="btn-ghost btn-block" id="back">返回</button>
    `;

    root.querySelector('#pool-pick').onchange = (e) => {
      poolId = e.target.value;
      go('rates', { poolId });
    };
    root.querySelector('#back').onclick = () => go('gallery');
  }

  paint();
}
