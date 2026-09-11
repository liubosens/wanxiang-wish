// 平台中立存储：浏览器 localStorage。
// H5 版只跑在浏览器/Capacitor WebView，wx / uni 分支不再需要。
// 与 miniprogram/utils/storage.js 的 localStorage 分支保持同一数据格式。

export function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function write(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
