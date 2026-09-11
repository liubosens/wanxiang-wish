/**
 * 平台中立存储适配层（支持 小程序wx / uni-app / 浏览器）
 * 让同一份核心逻辑既能跑在小程序、uni-app，也能跑在浏览器(localStorage)。
 * 多端迁移第一步：用本文件替换 save.js 里直接调用的 wx.getStorageSync / wx.setStorageSync。
 * 优先级：uni（uni-app 全端通用）> wx（小程序）> localStorage（浏览器 H5）。
 */
function getBackend() {
  if (typeof uni !== "undefined" && typeof uni.getStorageSync === "function") return "uni";
  if (typeof wx !== "undefined" && typeof wx.getStorageSync === "function") return "wx";
  if (typeof localStorage !== "undefined") return "ls";
  return null;
}

function read(key) {
  try {
    const b = getBackend();
    if (b === "uni") {
      const v = uni.getStorageSync(key);
      return v ? (typeof v === "string" ? JSON.parse(v) : v) : null;
    }
    if (b === "wx") {
      const v = wx.getStorageSync(key);
      return v ? (typeof v === "string" ? JSON.parse(v) : v) : null;
    }
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function write(key, data) {
  const b = getBackend();
  if (b === "uni") { uni.setStorageSync(key, data); return; }
  if (b === "wx") { wx.setStorageSync(key, data); return; }
  localStorage.setItem(key, JSON.stringify(data));
}

module.exports = { read, write, getBackend };
