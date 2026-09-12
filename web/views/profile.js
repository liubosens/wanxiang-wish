import * as save from '../core/save.js';
import * as api from '../core/api.js';
import { CONFIG } from '../core/config.js';
import { totalCards } from '../core/pools.js';
import { go } from '../core/router.js';
import { esc, toast, confirm, pct } from '../core/ui.js';

// 与后端 cloudflare/src/handlers/profile.ts 的 ALLOWED_AVATARS 保持一致。
const AVATARS = [
  '😀', '😎', '🤡', '👑', '🐉', '🦊', '🐼', '🚀',
  '⚔️', '🔥', '🌟', '🎲', '🍀', '🐟', '🎯', '🦄',
];
const NICK_MAX = 12;

export async function profileView(root) {
  // 页面内小状态机：编辑态用局部状态控制，避免整页跳转。
  const state = { nick: false, nickValue: '', avatar: false, acct: false, acctValue: '', busy: false };

  function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function paint() {
    const data = save.getSave();
    const meta = data.meta;
    const wallet = data.wallet;
    const total = totalCards();
    const owned = Object.keys(data.codex || {}).length;
    const nickname = meta.nickname || '未设置';
    const avatar = meta.avatar || '🙂';
    const accountId = api.getDeviceId();
    const cloud = api.isCloud();
    const claimedToday = meta.lastDailyAt === save.todayStr();

    root.innerHTML = `
      <div class="card">
        <div class="acct-head">
          <button class="avatar-btn" data-act="pick-avatar" title="更换头像">${esc(avatar)}</button>
          <div class="acct-main">
            ${
              state.nick
                ? `<input id="nick-input" class="input" maxlength="${NICK_MAX}" value="${esc(
                    state.nickValue,
                  )}" placeholder="输入昵称（≤${NICK_MAX} 字）" />
                   <div class="row" style="gap:6px;margin-top:6px">
                     <button class="btn-primary btn-sm" data-act="nick-save">保存</button>
                     <button class="btn-ghost btn-sm" data-act="nick-cancel">取消</button>
                   </div>`
                : `<div class="row">
                     <span class="nick">${esc(nickname)}</span>
                     <span class="spacer"></span>
                     <button class="btn-ghost btn-sm" data-act="nick-edit">修改昵称</button>
                   </div>`
            }
            <div class="muted small acct-id-row">
              账号 ID <span class="mono">${esc(accountId)}</span>
              <button class="btn-ghost btn-sm" data-act="copy-id">复制</button>
            </div>
          </div>
        </div>

        ${
          state.avatar
            ? `<div class="avatar-grid">
                 ${AVATARS.map(
                   (a) =>
                     `<button class="avatar-opt ${a === avatar ? 'on' : ''}" data-avatar="${esc(
                       a,
                     )}">${esc(a)}</button>`,
                 ).join('')}
               </div>
               <button class="btn-ghost btn-sm" data-act="avatar-cancel">收起</button>`
            : ''
        }

        <div class="muted small" style="margin-top:8px">
          数据模式：${cloud ? '云端（服务端权威）' : '本地（仅本机）'} ｜ 版本 ${esc(CONFIG.version)}
        </div>
      </div>

      <div class="card highlight">
        <div class="big">${meta.power || 0}</div>
        <div class="muted">战力（编队最优 5 张）</div>
        <div class="muted">图鉴完成度 ${pct(owned, total)}%（${owned}/${total}）</div>
      </div>

      <div class="card">
        <div class="title">数据概览</div>
        <div class="rows small">
          <div><span class="muted">加入时间</span><span class="spacer"></span><span>${fmtDate(
            meta.createdAt,
          )}</span></div>
          <div><span class="muted">累计抽取</span><span class="spacer"></span><span>${
            meta.totalDraws || 0
          } 次</span></div>
          <div><span class="muted">图鉴点亮</span><span class="spacer"></span><span>${owned} / ${total}</span></div>
          <div><span class="muted">PK 战绩</span><span class="spacer"></span><span>${
            meta.pkWin || 0
          } 胜 ${meta.pkLose || 0} 负</span></div>
        </div>
      </div>

      <div class="card">
        <div class="title">钱包</div>
        <div class="rows small">
          <div><span class="muted">祈愿石</span><span class="spacer"></span><span>${wallet.wish_stone}</span></div>
          <div><span class="muted">箱钥</span><span class="spacer"></span><span>${wallet.chest_key}</span></div>
          <div><span class="muted">机台币</span><span class="spacer"></span><span>${wallet.machine_coin}</span></div>
          <div><span class="muted">星尘币</span><span class="spacer"></span><span>${wallet.dust}</span></div>
          <div><span class="muted">荣耀积分</span><span class="spacer"></span><span>${wallet.point_wz}</span></div>
          <div><span class="muted">升星碎片</span><span class="spacer"></span><span>${wallet.fragments}</span></div>
          <div><span class="muted">进阶石</span><span class="spacer"></span><span>${wallet.stone}</span></div>
        </div>
      </div>

      <button class="btn-primary btn-block" data-act="daily" ${claimedToday ? 'disabled' : ''}>
        ${claimedToday ? '今日补给已领取' : '领取每日补给'}
      </button>
      <button class="btn-ghost btn-block" data-act="leaderboard">查看排行榜</button>
      <button class="btn-ghost btn-block" data-act="switch">切换账号 / 用账号 ID 恢复</button>

      ${
        state.acct
          ? `<div class="card">
               <div class="muted small">留空＝在本机新建账号；或粘贴已有账号 ID 恢复该账号。</div>
               <input id="acct-input" class="input" style="margin-top:8px" value="${esc(
                 state.acctValue,
               )}" placeholder="账号 ID（留空则新建）" />
               <div class="row" style="gap:6px;margin-top:8px">
                 <button class="btn-primary btn-sm" data-act="acct-go">确认切换</button>
                 <button class="btn-ghost btn-sm" data-act="acct-cancel">取消</button>
               </div>
             </div>`
          : ''
      }

      <button class="btn-danger btn-block" data-act="delete">${
        cloud ? '注销账号（清空云端数据）' : '重置本地存档'
      }</button>

      <div class="card muted small">
        隐私说明：${
          cloud
            ? '账号以本机随机 deviceId 标识，无手机号、无实名信息，数据仅用于本游戏进度。'
            : '当前为本地模式，全部数据仅存于本机浏览器，不会上传。'
        }
        本项目为概率机制演示，使用模拟币，不涉及真实货币、不提供提现。
      </div>
    `;

    bind();
  }

  function bind() {
    const on = (act, fn) => {
      const el = root.querySelector(`[data-act="${act}"]`);
      if (el) el.onclick = fn;
    };

    on('nick-edit', () => {
      state.nick = true;
      state.nickValue = save.getSave().meta.nickname || '';
      paint();
      const inp = root.querySelector('#nick-input');
      if (inp) inp.focus();
    });
    on('nick-cancel', () => {
      state.nick = false;
      paint();
    });
    on('nick-save', saveNick);

    on('pick-avatar', () => {
      state.avatar = !state.avatar;
      paint();
    });
    on('avatar-cancel', () => {
      state.avatar = false;
      paint();
    });
    root.querySelectorAll('[data-avatar]').forEach((b) => {
      b.onclick = () => pickAvatar(b.dataset.avatar);
    });

    on('copy-id', copyId);
    on('daily', doDaily);
    on('leaderboard', () => go('leaderboard'));
    on('switch', () => {
      state.acct = !state.acct;
      state.acctValue = '';
      paint();
      const inp = root.querySelector('#acct-input');
      if (inp) inp.focus();
    });
    on('acct-cancel', () => {
      state.acct = false;
      paint();
    });
    on('acct-go', doSwitch);
    on('delete', doDelete);

    // 输入即时回写 state，保证重绘（如展开头像面板）不丢已输入内容。
    const ni = root.querySelector('#nick-input');
    if (ni) ni.oninput = () => (state.nickValue = ni.value);
    const ai = root.querySelector('#acct-input');
    if (ai) ai.oninput = () => (state.acctValue = ai.value);
  }

  async function saveNick() {
    const name = (state.nickValue || '').trim();
    if (!name) return toast('昵称不能为空');
    if ([...name].length > NICK_MAX) return toast(`昵称最多 ${NICK_MAX} 个字`);
    if (state.busy) return;
    state.busy = true;
    try {
      await api.updateProfile({ nickname: name });
      toast(api.isCloud() ? '昵称已同步到云端' : '昵称已保存');
      state.nick = false;
    } catch (e) {
      toast(e.message || '保存失败');
    } finally {
      state.busy = false;
      paint();
    }
  }

  async function pickAvatar(a) {
    if (state.busy) return;
    state.busy = true;
    try {
      await api.updateProfile({ avatar: a });
      toast('头像已更新');
      state.avatar = false;
    } catch (e) {
      toast(e.message || '更新失败');
    } finally {
      state.busy = false;
      paint();
    }
  }

  async function copyId() {
    const id = api.getDeviceId();
    try {
      await navigator.clipboard.writeText(id);
      toast('账号 ID 已复制');
    } catch {
      window.prompt('手动复制账号 ID：', id);
    }
  }

  async function doDaily() {
    if (state.busy) return;
    state.busy = true;
    try {
      const r = await api.claimDaily();
      toast(r.claimed ? '补给已到账' : r.message || '今日已领取');
    } catch (e) {
      toast(e.message || '签到失败');
    } finally {
      state.busy = false;
      paint();
    }
  }

  function doSwitch() {
    const val = (state.acctValue || '').trim();
    if (val) {
      if (!confirm(`切换到账号 ${val}？本机当前进度会被替换为该账号的云端档案。`, '切换账号')) return;
      api.setDeviceId(val);
    } else {
      if (!confirm('在本机新建一个账号？当前进度会从零开始（原账号仍保留在云端）。', '新建账号')) return;
      api.newDeviceId();
    }
    save.reset();
    toast(val ? '正在切换到该账号…' : '已新建账号');
    setTimeout(() => location.reload(), 400);
  }

  async function doDelete() {
    const cloud = api.isCloud();
    if (
      !confirm(
        cloud
          ? '将永久删除该账号在云端的全部数据（钱包、背包、图鉴、记录），不可撤销。'
          : '将清空本机存档，不可撤销。',
        cloud ? '注销账号' : '重置本地存档',
      )
    ) {
      return;
    }
    if (state.busy) return;
    state.busy = true;
    try {
      if (cloud) await api.deleteAccount();
      save.reset();
      api.newDeviceId();
      toast('已注销');
      setTimeout(() => location.reload(), 500);
    } catch (e) {
      state.busy = false;
      toast(e.message || '注销失败');
    }
  }

  // 云端模式先拉一次服务端档案，保证图鉴/战力/统计为最新（本地快照仅作展示缓存）。
  if (api.isCloud()) {
    try {
      await api.refreshMe();
    } catch {
      // 离线时退回本地快照，不阻塞页面
    }
  }

  paint();
}
