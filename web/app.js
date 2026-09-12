import * as api from './core/api.js';
import { currentRoute } from './core/router.js';
import { esc } from './core/ui.js';

import { galleryView } from './views/gallery.js';
import { bannerView } from './views/banner.js';
import { chestView } from './views/chest.js';
import { machineView } from './views/machine.js';
import { inventoryView } from './views/inventory.js';
import { historyView } from './views/history.js';
import { ratesView } from './views/rates.js';
import { profileView } from './views/profile.js';
import { leaderboardView } from './views/leaderboard.js';
import { pkView } from './views/pk.js';
import { questsView } from './views/quests.js';
import { towerView } from './views/tower.js';

const VIEWS = {
  gallery: galleryView,
  banner: bannerView,
  chest: chestView,
  machine: machineView,
  inventory: inventoryView,
  history: historyView,
  rates: ratesView,
  profile: profileView,
  leaderboard: leaderboardView,
  pk: pkView,
  quests: questsView,
  tower: towerView,
};

const TITLES = {
  gallery: '概率馆',
  banner: '标准祈愿',
  chest: '分级宝箱',
  machine: '星轨转盘',
  inventory: '背包',
  history: '抽卡记录',
  rates: '概率公示',
  profile: '我的',
  leaderboard: '排行榜',
  pk: '对战',
  quests: '任务',
  tower: '试炼塔',
};

const TABS = [
  { route: 'gallery', label: '概率馆' },
  { route: 'inventory', label: '背包' },
  { route: 'history', label: '记录' },
  { route: 'leaderboard', label: '排行' },
  { route: 'profile', label: '我的' },
];

// 非 tab 页面归属到某个 tab，用于底部高亮
const TAB_OF = {
  gallery: 'gallery',
  banner: 'gallery',
  chest: 'gallery',
  machine: 'gallery',
  rates: 'gallery',
  inventory: 'inventory',
  history: 'history',
  leaderboard: 'leaderboard',
  pk: 'leaderboard',
  quests: 'gallery',
  tower: 'gallery',
  profile: 'profile',
};

function renderTabbar(active) {
  const nav = document.getElementById('tabbar');
  nav.innerHTML = TABS.map(
    (t) =>
      `<button data-route="${t.route}" class="${t.route === active ? 'active' : ''}">${
        t.label
      }</button>`,
  ).join('');
  nav.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      location.hash = `#/${b.dataset.route}`;
    };
  });
}

function renderBadge() {
  const el = document.getElementById('mode-badge');
  if (!el) return;
  el.textContent = api.isCloud() ? '云端' : '本地';
  el.classList.toggle('cloud', api.isCloud());
}

let seq = 0;

async function render() {
  const { route, params } = currentRoute();
  const view = VIEWS[route] || VIEWS.gallery;
  const root = document.getElementById('view');
  const mySeq = ++seq;

  document.getElementById('topbar-title').textContent = TITLES[route] || '万象祈愿';
  renderTabbar(TAB_OF[route] || route);
  renderBadge();

  if (!VIEWS[route]) {
    // 未知路由回落到概率馆
    location.replace('#/gallery');
    return;
  }

  root.innerHTML = '<div class="loading">加载中…</div>';

  try {
    // 云端模式：确保 token 有效（已有 token 时 login 内部会直接返回）
    if (api.isCloud()) await api.login();
    await view(root, params);
  } catch (e) {
    if (mySeq !== seq) return;
    root.innerHTML = `
      <div class="card">
        <div class="title">加载失败</div>
        <div class="muted">${esc(e.message || e)}</div>
      </div>
      <button class="btn-ghost btn-block" id="retry">重试</button>
    `;
    const retry = root.querySelector('#retry');
    if (retry) retry.onclick = () => render();
  }
}

if (!location.hash) {
  history.replaceState(null, '', '#/gallery');
}

window.addEventListener('hashchange', render);

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', render);
} else {
  render();
}
