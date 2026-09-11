import * as save from '../core/save.js';
import * as api from '../core/api.js';
import { getPool, POOLS } from '../core/pools.js';
import { go } from '../core/router.js';
import { esc, toast } from '../core/ui.js';

// C2 场景：权重转盘 + 荣耀积分兑换指定 UR。
// 王者池以 presentation === 'machine' 标记；无该字段时退回按 sceneType === 'C2' 兜底。
function machinePools() {
  const byPresentation = Object.keys(POOLS).filter((id) => POOLS[id].presentation === 'machine');
  if (byPresentation.length) return byPresentation;
  return Object.keys(POOLS).filter((id) => POOLS[id].sceneType === 'C2');
}

export async function machineView(root, params) {
  const pools = machinePools();
  const poolId = pools.includes(params.get('poolId')) ? params.get('poolId') : pools[0];

  let result = null;
  let spinning = false;

  async function spin() {
    if (spinning) return;
    spinning = true;
    result = null;
    paint();
    try {
      const res = await api.draw({ poolId, times: 1 });
      result = (res.results || [])[0] || null;
    } catch (e) {
      toast(e.message || '转动失败');
    } finally {
      spinning = false;
      paint();
    }
  }

  async function doExchange() {
    try {
      const res = await api.exchange({ poolId });
      toast(`已兑换 ${res.item.name}`);
      paint();
    } catch (e) {
      toast(e.message || '兑换失败');
    }
  }

  function paint() {
    const pool = getPool(poolId);
    const data = save.getSave();
    const wallet = data.wallet;
    const ex = pool.exchange;
    const unit = pool.cost.amount || 1;
    const canSpin = (wallet[pool.cost.itemId] || 0) >= unit;
    const points = wallet.point_wz || 0;
    const owned = !!(ex && data.inventory[ex.itemId]);
    const canExchange = !!ex && points >= (ex.cost || 0);
    const ratio = ex && ex.cost ? Math.min(100, (points / ex.cost) * 100) : 0;

    root.innerHTML = `
      <div class="card">
        <div class="title">${esc(pool.name)}</div>
        <div class="wheel ${spinning ? 'spin' : ''}">✦</div>
        <div class="muted">
          机台币：${wallet.machine_coin} ｜ 荣耀积分：${points}
        </div>
        <div class="actions">
          <button class="btn-primary" data-act="spin" ${spinning || !canSpin ? 'disabled' : ''}>
            ${spinning ? '转动中…' : `转动一次（${esc(api.currencyLabel(pool.cost.itemId))} ×${unit}）`}
          </button>
          <button class="btn-ghost btn-sm" data-act="rates">公示</button>
        </div>
      </div>

      ${
        result
          ? `<div class="card">
               <div class="title">停在</div>
               <div class="rarity-${esc(result.rarity)} big">${esc(result.name)}</div>
               <div class="muted">稀有度 ${esc(result.rarity)}</div>
             </div>`
          : ''
      }

      ${
        ex
          ? `<div class="card">
               <div class="title">荣耀兑换</div>
               <div class="muted">
                 满 ${ex.cost} 积分可兑换 UR「${esc(ex.name)}」${owned ? '（已拥有，可继续兑换）' : ''}
               </div>
               <div class="progress"><div class="bar" style="width:${ratio}%"></div></div>
               <div class="muted small">${points} / ${ex.cost}</div>
               <div class="actions">
                 <button class="btn-primary" data-act="exchange" ${
                   canExchange ? '' : 'disabled'
                 }>${canExchange ? `兑换 ${esc(ex.name)}` : '积分不足'}</button>
               </div>
             </div>`
          : ''
      }

      <button class="btn-ghost btn-block" data-act="back">返回概率馆</button>
    `;

    root.querySelector('[data-act="spin"]').onclick = spin;
    root.querySelector('[data-act="exchange"]').onclick = doExchange;
    root.querySelector('[data-act="rates"]').onclick = () => go('rates', { poolId });
    root.querySelector('[data-act="back"]').onclick = () => go('gallery');
  }

  paint();
}
