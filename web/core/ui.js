// 通用 UI 工具：toast、确认框、转义、格式化。

let toastTimer;

export function toast(message, ms = 1800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, ms);
}

export function confirm(message, title = '确认') {
  return window.confirm(`${title}\n\n${message}`);
}

// 把用户可见文本转义后再拼进 innerHTML（昵称、卡名都可能来自服务端）。
export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function pct(a, b) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

export function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}
