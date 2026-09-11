import * as api from '../core/api.js';
import { go } from '../core/router.js';
import { esc, toast } from '../core/ui.js';

export async function leaderboardView(root) {
  let state = { rows: [], me: { rank: 0, power: 0 } };
  let loading = true;

  async function load() {
    loading = true;
    paint();
    try {
      state = await api.leaderboard();
    } catch (e) {
      toast(e.message || '排行榜加载失败');
    } finally {
      loading = false;
      paint();
    }
  }

  function challengeNext() {
    const { rows, me } = state;
    if (!me || me.rank <= 1) return;
    const opp = rows.find((r) => r.rank === me.rank - 1) || rows[rows.length - 1];
    if (!opp) return;
    go('pk', { opponentId: opp.id, oppName: opp.name, oppPower: opp.power });
  }

  function paint() {
    const { rows, me } = state;
    const canChallenge = !loading && me.rank > 1 && rows.length > 0;

    root.innerHTML = `
      <div class="card">
        <div class="title">排行榜 · 战力榜</div>
        <div class="muted">你的排名 #${me.rank || '-'} ｜ 战力 ${me.power || 0}</div>
        <div class="muted small" style="margin-top:4px">
          ${api.isCloud() ? '全服真实玩家战力排序' : '本地模式：由内置对手模拟，非真实联机'}
        </div>
      </div>

      ${
        loading
          ? '<div class="loading">加载中…</div>'
          : `<div class="card">
               <div class="rows">
                 ${rows
                   .map(
                     (r) => `
                   <div class="row">
                     <span class="rank ${
                       r.rank <= 3 ? `rank-${r.rank}` : ''
                     }">${r.rank}</span>
                     <span class="name ${r.isMe ? 'me' : ''}">${esc(r.name)}${
                       r.isMe && r.name !== '你' ? '（你）' : ''
                     }</span>
                     <span class="pw">${r.power}</span>
                   </div>`,
                   )
                   .join('')}
               </div>
             </div>`
      }

      <button class="btn-primary btn-block" data-act="fight" ${canChallenge ? '' : 'disabled'}>
        ${me.rank <= 1 && !loading ? '已是榜首' : '挑战上一名'}
      </button>
      <button class="btn-ghost btn-block" data-act="reload">刷新</button>
    `;

    root.querySelector('[data-act="fight"]').onclick = challengeNext;
    root.querySelector('[data-act="reload"]').onclick = load;
  }

  await load();
}
