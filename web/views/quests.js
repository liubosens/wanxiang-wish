import * as api from '../core/api.js';
import { esc, toast } from '../core/ui.js';

// 任务/成就页（云端模式专属：进度与领奖全部服务端权威）。
// 每日 UTC+8 重置；每周一重置；成就一次性。
export async function questsView(root) {
  let busy = false;

  function rewardText(reward) {
    const NAMES = {
      wish_stone: '祈愿石', chest_key: '箱钥', machine_coin: '机台币',
      dust: '星尘', stone: '进阶石', fragments: '碎片',
    };
    return Object.entries(reward || {})
      .map(([k, v]) => `${NAMES[k] || k}×${v}`)
      .join(' ');
  }

  function questRow(q) {
    const done = q.progress >= q.target;
    const btn = q.claimed
      ? '<span class="muted">已领取</span>'
      : q.canClaim
        ? `<button class="btn-primary btn-sm" data-claim="${esc(q.questId)}">领取</button>`
        : `<button class="btn-primary btn-sm" disabled>${q.progress}/${q.target}</button>`;
    return `
      <div class="row between">
        <div>
          <div class="${q.claimed ? 'muted' : ''}">${esc(q.title)}</div>
          <div class="muted small">${esc(rewardText(q.reward))}${!q.claimed && !done ? ` ｜ 进度 ${q.progress}/${q.target}` : ''}</div>
        </div>
        ${btn}
      </div>`;
  }

  async function paint() {
    const state = await api.fetchQuests();
    if (!state) {
      root.innerHTML = `
        <div class="card">
          <div class="title">任务</div>
          <div class="muted">任务与成就系统需要云端模式。当前为本地模式，请配置服务端后使用。</div>
        </div>`;
      return;
    }

    const box = state.dailyBox;
    const boxBtn = box.claimed
      ? '<span class="muted">已开启</span>'
      : box.canClaim
        ? `<button class="btn-primary btn-sm" data-claim="${esc(box.questId)}">开启</button>`
        : '<button class="btn-primary btn-sm" disabled>未达成</button>';

    root.innerHTML = `
      <div class="card">
        <div class="title">每日任务</div>
        <div class="muted small">每日 0 点（UTC+8）重置 ｜ ${esc(state.periodKey.daily)}</div>
        <div style="margin-top:8px">${state.daily.map(questRow).join('')}</div>
        <div class="row between" style="margin-top:10px;border-top:1px dashed #ccc;padding-top:8px">
          <div>
            <div>🎁 ${esc(box.title)}</div>
            <div class="muted small">${esc(rewardText(box.reward))} ｜ 完成并领取全部每日任务后开启</div>
          </div>
          ${boxBtn}
        </div>
      </div>

      <div class="card">
        <div class="title">每周任务</div>
        <div class="muted small">周一 0 点（UTC+8）重置 ｜ ${esc(state.periodKey.weekly)}</div>
        <div style="margin-top:8px">${state.weekly.map(questRow).join('')}</div>
      </div>

      ${
        state.event
          ? `
      <div class="card">
        <div class="title">🎉 ${esc(state.event.title)}</div>
        <div class="muted small">限时活动任务，活动结束后不可领取</div>
        <div style="margin-top:8px">${state.event.quests.map(questRow).join('') || '<div class="muted small">本期无附加任务</div>'}</div>
      </div>`
          : ''
      }

      <div class="card">
        <div class="title">成就</div>
        <div class="muted small">一次性奖励，完成后永久保留</div>
        <div style="margin-top:8px">${state.achievements.map(questRow).join('')}</div>
      </div>
    `;

    root.querySelectorAll('[data-claim]').forEach((el) => {
      el.onclick = async () => {
        if (busy) return;
        busy = true;
        try {
          const res = await api.claimQuest(el.dataset.claim);
          if (res && !res.alreadyClaimed) {
            toast(`已领取：${rewardText(res.reward)}`);
          }
        } catch (e) {
          toast(e.message || '领取失败');
        } finally {
          busy = false;
          await paint();
        }
      };
    });
  }

  if (!api.isCloud()) {
    await paint();
    return;
  }
  root.innerHTML = '<div class="loading">加载任务…</div>';
  await paint();
}
