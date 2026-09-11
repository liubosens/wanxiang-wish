import * as save from '../core/save.js';
import * as api from '../core/api.js';
import { CONFIG } from '../core/config.js';
import { totalCards } from '../core/pools.js';
import { go } from '../core/router.js';
import { esc, toast, confirm, pct } from '../core/ui.js';

export async function profileView(root) {
  function paint() {
    const data = save.getSave();
    const total = totalCards();
    const owned = Object.keys(data.codex || {}).length;
    const wallet = data.wallet;
    const meta = data.meta;
    const nickname = meta.nickname || '未设置';

    root.innerHTML = `
      <div class="card">
        <div class="title">万象祈愿</div>
        <div class="muted">版本 ${esc(CONFIG.version)} · 模拟币</div>
        <div class="row" style="margin-top:10px">
          <span class="muted">昵称</span>
          <span class="spacer"></span>
          <span>${esc(nickname)}</span>
          <button class="btn-ghost btn-sm" data-act="nick">修改</button>
        </div>
        <div class="row" style="margin-top:6px">
          <span class="muted">数据模式</span>
          <span class="spacer"></span>
          <span>${api.isCloud() ? '云端（服务端权威）' : '本地（仅本机）'}</span>
        </div>
      </div>

      <div class="card highlight">
        <div class="big">${meta.power || 0}</div>
        <div class="muted">战力（编队最优 5 张）</div>
        <div class="muted">图鉴完成度 ${pct(owned, total)}%（${owned}/${total}）</div>
      </div>

      <div class="card">
        <div class="rows small">
          <div><span class="muted">祈愿石</span><span class="spacer"></span><span>${wallet.wish_stone}</span></div>
          <div><span class="muted">箱钥</span><span class="spacer"></span><span>${wallet.chest_key}</span></div>
          <div><span class="muted">机台币</span><span class="spacer"></span><span>${wallet.machine_coin}</span></div>
          <div><span class="muted">星尘币</span><span class="spacer"></span><span>${wallet.dust}</span></div>
          <div><span class="muted">荣耀积分</span><span class="spacer"></span><span>${wallet.point_wz}</span></div>
          <div><span class="muted">升星碎片</span><span class="spacer"></span><span>${wallet.fragments}</span></div>
          <div><span class="muted">进阶石</span><span class="spacer"></span><span>${wallet.stone}</span></div>
        </div>
        <div class="muted small" style="margin-top:10px">
          累计抽取 ${meta.totalDraws || 0} 次 ｜ PK ${meta.pkWin || 0} 胜 ${meta.pkLose || 0} 负
        </div>
      </div>

      ${
        api.isCloud()
          ? `<div class="card muted small">云端模式：每日补给需由服务端发放，暂未开放。</div>`
          : `<button class="btn-primary btn-block" data-act="daily">领取每日补给</button>`
      }
      <button class="btn-ghost btn-block" data-act="leaderboard">查看排行榜</button>
      <button class="btn-ghost btn-block" data-act="reset">重置本地存档</button>

      <div class="card muted small">
        隐私说明：${
          api.isCloud()
            ? '账号以本机随机 deviceId 标识，无手机号、无实名信息，数据仅用于本游戏进度。'
            : '当前为本地模式，全部数据仅存于本机浏览器，不会上传。'
        }
        本项目为概率机制演示，使用模拟币，不涉及真实货币、不提供提现。
      </div>
    `;

    const nickBtn = root.querySelector('[data-act="nick"]');
    if (nickBtn) nickBtn.onclick = editNickname;

    const dailyBtn = root.querySelector('[data-act="daily"]');
    if (dailyBtn) dailyBtn.onclick = claimDaily;

    root.querySelector('[data-act="leaderboard"]').onclick = () => go('leaderboard');
    root.querySelector('[data-act="reset"]').onclick = doReset;
  }

  async function editNickname() {
    const cur = save.getSave().meta.nickname || '';
    const next = window.prompt('昵称将显示在排行榜上（最多 12 字）', cur);
    if (next === null) return;
    const name = next.trim().slice(0, 12);
    save.update((s) => {
      s.meta.nickname = name;
    });
    if (api.isCloud()) {
      // 服务端在 login 时会同步昵称，这里重登一次让它生效
      api.logout();
      try {
        await api.login(true);
        toast('昵称已同步到云端');
      } catch (e) {
        toast(`昵称已存本机，云端同步失败：${e.message}`);
      }
    } else {
      toast('昵称已保存');
    }
    paint();
  }

  function claimDaily() {
    const data = save.claimDaily();
    toast(data._dailyClaimed === false ? '今日已领取' : '补给已到账');
    paint();
  }

  function doReset() {
    if (
      !confirm(
        '将清空本机的钱包、背包、图鉴与记录，并断开当前账号绑定。此操作不可撤销。',
        '重置本地存档',
      )
    ) {
      return;
    }
    save.reset();
    api.logout();
    toast('已重置');
    location.hash = '#/gallery';
    location.reload();
  }

  paint();
}
