import * as api from '../core/api.js';
import { esc, toast } from '../core/ui.js';

// 试炼塔（云端模式专属）。爬层制 PVE，进阶石主产出点。
// 每日 3 次挑战（成败均耗次数）+ 已通最高层免费扫荡 1 次；每 5 层首通发进阶石。
export async function towerView(root) {
  let busy = false;

  function rewardText(reward) {
    const NAMES = { wish_stone: '祈愿石', chest_key: '箱钥', machine_coin: '机台币', dust: '星尘', stone: '进阶石', fragments: '碎片' };
    return Object.entries(reward || {})
      .map(([k, v]) => `${NAMES[k] || k}×${v}`)
      .join(' ');
  }

  async function paint() {
    const info = await api.fetchTower();
    if (!info) {
      root.innerHTML = `
        <div class="card">
          <div class="title">试炼塔</div>
          <div class="muted">试炼塔需要云端模式。当前为本地模式，请配置服务端后使用。</div>
        </div>`;
      return;
    }

    const { state, nextFloor, config } = info;
    const myPower = (await api.refreshMe()).meta.power || 0;

    root.innerHTML = `
      <div class="card">
        <div class="title">试炼塔</div>
        <div class="muted">已通 ${state.bestFloor} / ${config.floorMax} 层 ｜ 我的战力 ${myPower}</div>
        <div class="muted">今日剩余挑战 ${state.challengesLeft} 次 ｜ 每 ${config.milestoneEvery} 层首通发进阶石</div>
      </div>

      ${
        nextFloor
          ? `
      <div class="card">
        <div class="title">第 ${nextFloor.floor} 层</div>
        <div class="muted">守将：${esc(nextFloor.enemy.name)}（${esc(nextFloor.enemy.rarity)}）</div>
        <div class="muted">敌方战力 ${nextFloor.enemy.power}${nextFloor.enemy.power > myPower ? '（高于你）' : ''}</div>
        <button class="btn-primary btn-block" id="challenge" ${state.challengesLeft > 0 && !busy ? '' : 'disabled'}>
          ${state.challengesLeft > 0 ? '挑战（消耗 1 次）' : '今日次数已用完'}
        </button>
      </div>`
          : `
      <div class="card">
        <div class="title">🏆 已通关全部 ${config.floorMax} 层</div>
        <div class="muted">塔的尽头。等校准版本更新新锚点吧。</div>
      </div>`
      }

      <div class="card">
        <div class="row between">
          <div>
            <div class="title">扫荡</div>
            <div class="muted small">每日 1 次，按已通最高层（${state.bestFloor} 层）领取碎片×20 + 星尘×40</div>
          </div>
          <button class="btn-primary btn-sm" id="sweep" ${state.sweepAvailable && !busy ? '' : 'disabled'}>
            ${state.sweepAvailable ? '扫荡' : '已扫荡'}
          </button>
        </div>
      </div>
    `;

    const chBtn = root.querySelector('#challenge');
    if (chBtn) {
      chBtn.onclick = async () => {
        if (busy) return;
        busy = true;
        try {
          const res = await api.challengeTower();
          if (res.win) {
            toast(`通关第 ${res.floor} 层！获得 ${rewardText(res.rewards)}${res.milestone ? '（里程碑！）' : ''}`);
          } else {
            toast(`挑战失败（敌方 ${res.enemyPower}），安慰奖 ${rewardText(res.rewards)}`);
          }
        } catch (e) {
          toast(e.message || '挑战失败');
        } finally {
          busy = false;
          await paint();
        }
      };
    }

    const swBtn = root.querySelector('#sweep');
    if (swBtn) {
      swBtn.onclick = async () => {
        if (busy) return;
        busy = true;
        try {
          const res = await api.sweepTower();
          toast(`扫荡完成：${rewardText(res.rewards)}`);
        } catch (e) {
          toast(e.message || '扫荡失败');
        } finally {
          busy = false;
          await paint();
        }
      };
    }
  }

  if (!api.isCloud()) {
    await paint();
    return;
  }
  root.innerHTML = '<div class="loading">加载试炼塔…</div>';
  await paint();
}
