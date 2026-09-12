import * as save from '../core/save.js';
import * as api from '../core/api.js';
import { esc, toast, pct } from '../core/ui.js';
import { bondStates, bondBonusSum, BOND_CAP } from '../core/bonds-config.js';

// 稀有度排序权重（背包列表用）：UR > SSR > SR > R。
const RARITY_ORDER = { UR: 0, SSR: 1, SR: 2, R: 3 };

export async function inventoryView(root) {
  let busy = false;

  async function doUpgrade(itemId) {
    if (busy) return;
    busy = true;
    try {
      const res = await api.upgrade({ itemId });
      toast(`升至 ★${res.item.star}`);
    } catch (e) {
      toast(e.message || '升星失败');
    } finally {
      busy = false;
      await paint();
    }
  }

  async function paint() {
    if (api.isCloud()) {
      try {
        await api.refreshMe();
      } catch {
        toast('云端同步失败，显示本地缓存');
      }
    }

    const data = save.getSave();
    const wallet = data.wallet;
    const codexCount = Object.keys(data.codex || {}).length;

    const items = Object.keys(data.inventory)
      .map((id) => ({ itemId: id, ...data.inventory[id] }))
      .filter((it) => (it.count || 0) > 0)
      .sort(
        (a, b) =>
          (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) ||
          (b.star || 0) - (a.star || 0),
      );

    // 羁绊：拥有即激活，由本地 inventory 实时推导（云端模式下 save 为服务端镜像，口径一致）
    const bonds = bondStates(data.inventory);
    const activeBonus = Math.min(bondBonusSum(data.inventory), BOND_CAP);
    const byWorld = bonds.reduce((m, b) => {
      (m[b.worldName] = m[b.worldName] || []).push(b);
      return m;
    }, {});
    const bondHtml = Object.keys(byWorld)
      .map((worldName) => {
        const rows = byWorld[worldName]
          .map(
            (b) => `
            <div class="row between">
              <span class="${b.activated ? '' : 'muted'}">${esc(b.name)}
                <span class="muted small">（${b.itemIds.length} 张${b.activated ? '' : ` · 缺 ${b.itemIds.length - b.ownedCount}`}）</span>
              </span>
              <span class="${b.activated ? '' : 'muted'}">${b.activated ? `+${Math.round(b.bonus * 100)}%` : '未激活'}</span>
            </div>`,
          )
          .join('');
        return `<div class="muted small" style="margin-top:8px">${esc(worldName)}</div>${rows}`;
      })
      .join('');

    root.innerHTML = `
      <div class="card">
        <div class="title">背包</div>
        <div class="muted">图鉴已点亮 ${codexCount} 种 ｜ 战力 ${data.meta.power || 0}${activeBonus ? `（羁绊 +${Math.round(activeBonus * 100)}%）` : ''}</div>
        <div class="muted">碎片 ${wallet.fragments} ｜ 进阶石 ${wallet.stone}</div>
      </div>

      <div class="card">
        <div class="row between">
          <div class="title">图鉴羁绊</div>
          <div class="muted small">总加成 +${Math.round(activeBonus * 100)}% ｜ 上限 ${Math.round(BOND_CAP * 100)}%</div>
        </div>
        ${bondHtml}
      </div>

      ${
        items.length
          ? items
              .map((it) => {
                const cost = api.previewCost(it.itemId);
                const canUp =
                  !!cost &&
                  !cost.max &&
                  (wallet.fragments || 0) >= cost.fragments &&
                  (wallet.stone || 0) >= cost.stone;
                const costText = cost
                  ? cost.max
                    ? '已满星'
                    : `升 ★${cost.nextStar}：碎片 ${cost.fragments}${
                        cost.stone ? ` · 进阶石 ${cost.stone}` : ''
                      }`
                  : '';
                return `
                  <div class="card">
                    <div class="row between">
                      <div>
                        <div>
                          <span class="rarity-${esc(it.rarity)}">[${esc(it.rarity)}]</span>
                          <span> ${esc(it.name)}</span>
                          <span class="muted"> ★${it.star || 0}</span>
                        </div>
                        <div class="muted small">${esc(costText)} ｜ 持有 ${it.count}</div>
                      </div>
                      <button class="btn-primary btn-sm" data-up="${esc(it.itemId)}" ${
                        canUp ? '' : 'disabled'
                      }>升星</button>
                    </div>
                  </div>`;
              })
              .join('')
          : `<div class="card muted">还没有卡牌，去概率馆抽一次吧。</div>`
      }
    `;

    root.querySelectorAll('[data-up]').forEach((el) => {
      el.onclick = () => doUpgrade(el.dataset.up);
    });
  }

  if (api.isCloud()) {
    root.innerHTML = '<div class="loading">同步云端背包…</div>';
  }
  await paint();
}
