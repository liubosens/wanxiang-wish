import * as api from '../core/api.js';
import { esc, timeAgo, toast } from '../core/ui.js';

export async function historyView(root) {
  root.innerHTML = '<div class="loading">加载中…</div>';

  let rows = [];
  try {
    rows = await api.fetchHistory(100);
  } catch (e) {
    toast(e.message || '记录加载失败');
  }

  // 服务端返回 snake_case，本地存档是 camelCase，这里统一成展示结构。
  const list = rows.map((r) => ({
    id: r.id || `${r.item_id || r.itemId}_${r.at}`,
    itemId: r.item_id || r.itemId,
    name: r.name,
    rarity: r.rarity,
    poolName: r.pool_name || r.poolName || '',
    at: r.at,
  }));

  if (!list.length) {
    root.innerHTML = '<div class="card muted">暂无抽卡记录。</div>';
    return;
  }

  root.innerHTML = `
    <div class="card">
      <div class="title">抽卡记录</div>
      <div class="muted">最近 ${list.length} 条</div>
    </div>
    <div class="card">
      <div class="rows">
        ${list
          .map(
            (r) => `
          <div class="row">
            <div style="flex:1;min-width:0">
              <div>
                <span class="rarity-${esc(r.rarity)}">[${esc(r.rarity)}]</span>
                <span> ${esc(r.name)}</span>
              </div>
              <div class="muted small">${esc(r.poolName)} ｜ ${esc(timeAgo(r.at))}</div>
            </div>
          </div>`,
          )
          .join('')}
      </div>
    </div>
  `;
}
