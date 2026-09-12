import * as save from '../core/save.js';
import * as api from '../core/api.js';
import { go } from '../core/router.js';
import { esc } from '../core/ui.js';

const SCENES = [
  { route: 'banner', title: '原神 · 星轨祈愿', desc: 'A1 卡池 · 74 软保底 / 90 硬保底' },
  { route: 'chest', title: '三国杀 · 全服博弈', desc: 'B1 分级宝箱 · 全服累积保底' },
  { route: 'machine', title: '王者 · 荣耀积攒', desc: 'C2 权重转盘 · 积分兑换指定 UR' },
];

function fmtEnd(endAt) {
  const d = new Date(endAt);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function galleryView(root) {
  const w = save.getSave().wallet;
  const power = save.getSave().meta.power || 0;

  // 限时活动横幅（云端模式；活动判定在服务端，这里只展示）
  let eventsHtml = '';
  if (api.isCloud()) {
    try {
      const ev = await api.fetchEvents();
      if (ev) {
        const active = (ev.active || [])
          .map(
            (e) => `
          <div class="row between">
            <span>🔥 ${esc(e.title)}</span>
            <span class="muted small">${fmtEnd(e.endAt)} 结束</span>
          </div>`,
          )
          .join('');
        const upcoming = (ev.upcoming || [])
          .map(
            (e) => `
          <div class="row between muted">
            <span>📅 ${esc(e.title)}</span>
            <span class="small">${fmtEnd(e.startAt)} 开始</span>
          </div>`,
          )
          .join('');
        if (active || upcoming) {
          eventsHtml = `
          <div class="card">
            <div class="title">限时活动</div>
            ${active}${upcoming}
          </div>`;
        }
      }
    } catch {
      // 活动拉取失败不阻塞大厅
    }
  }

  root.innerHTML = `
    <div class="card">
      <div class="brand">万象祈愿</div>
      <div class="muted">概率博物馆 · 模拟币</div>
      <div class="rows small" style="margin-top:12px">
        <div><span class="muted">祈愿石</span><span class="spacer"></span><span>${w.wish_stone}</span></div>
        <div><span class="muted">箱钥</span><span class="spacer"></span><span>${w.chest_key}</span></div>
        <div><span class="muted">机台币</span><span class="spacer"></span><span>${w.machine_coin}</span></div>
        <div><span class="muted">战力</span><span class="spacer"></span><span>${power}</span></div>
      </div>
    </div>

    ${eventsHtml}

    ${SCENES.map(
      (s) => `
      <div class="card tappable" data-route="${s.route}">
        <div class="title">${esc(s.title)}</div>
        <div class="muted">${esc(s.desc)}</div>
      </div>
    `,
    ).join('')}

    <div class="card tappable" data-route="quests">
      <div class="title">每日任务与成就</div>
      <div class="muted">每日/每周任务领资源，全勤宝箱发进阶石（云端模式）</div>
    </div>

    <div class="card tappable" data-route="tower">
      <div class="title">试炼塔</div>
      <div class="muted">50 层爬塔 PVE，每 5 层首通发进阶石（云端模式）</div>
    </div>

    <button class="btn-ghost btn-block" data-route="rates">查看概率公示</button>
    <div class="card muted small">
      本项目为概率机制演示，全部使用模拟币，不涉及任何真实货币与提现。
    </div>
  `;

  root.querySelectorAll('[data-route]').forEach((el) => {
    el.onclick = () => go(el.dataset.route);
  });
}
