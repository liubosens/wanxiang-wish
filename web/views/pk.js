import * as save from '../core/save.js';
import * as api from '../core/api.js';
import { go } from '../core/router.js';
import { esc, toast } from '../core/ui.js';

export async function pkView(root, params) {
  const opponentId = params.get('opponentId') || '';
  const oppName = params.get('oppName') || '对手';
  const oppPower = parseInt(params.get('oppPower') || '0', 10);

  let result = null;
  let fighting = false;

  async function doBattle() {
    if (fighting) return;
    fighting = true;
    result = null;
    paint();
    try {
      result = await api.pk({ opponentId });
    } catch (e) {
      toast(e.message || '对战失败');
    } finally {
      fighting = false;
      paint();
    }
  }

  function paint() {
    const myPower = save.getSave().meta.power || 0;

    root.innerHTML = `
      <div class="card">
        <div class="title">对战 · ${esc(oppName)}</div>
        <div class="muted">对方战力 ${oppPower || '未知'} ｜ 你的战力 ${myPower}</div>
        <div class="muted small" style="margin-top:6px">
          规则：双方战力 ×(0.85~1.15) 方差结算，随机源在服务端。真爬榜靠升星抬战力。
        </div>
      </div>

      ${
        !result
          ? `<div class="card">
               <button class="btn-primary btn-block" data-act="fight" ${fighting ? 'disabled' : ''}>
                 ${fighting ? '对战中…' : '发起对战'}
               </button>
             </div>`
          : `<div class="card">
               <div class="outcome ${result.win ? 'win' : 'lose'}">${
                 result.win ? '胜利' : '失败'
               }</div>
               <div class="muted" style="text-align:center">
                 你 ${result.myVal} ｜ ${esc(result.oppName)} ${result.oppVal}
               </div>
               <div class="muted small" style="text-align:center;margin-top:8px">
                 ${
                   result.win
                     ? '奖励：祈愿石 +5 ｜ 进阶石 +1'
                     : '再接再厉，升星提升战力可稳赢。'
                 }
               </div>
               <button class="btn-primary btn-block" data-act="fight">再战</button>
             </div>`
      }

      <button class="btn-ghost btn-block" data-act="back">返回排行榜</button>
    `;

    root.querySelector('[data-act="fight"]').onclick = doBattle;
    root.querySelector('[data-act="back"]').onclick = () => go('leaderboard');
  }

  paint();
}
