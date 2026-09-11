export const CONFIG = {
  // Cloudflare Worker 生产地址（自定义域名，绕开被墙/未激活的 *.workers.dev）。
  // 留空 + forceLocal=false 时自动退回本地 Mock 掷骰（数据只存本机）。
  apiBase: 'https://wish.liubs.xyz',

  // 调试用：置 true 可强制离线模式，忽略 apiBase。
  forceLocal: false,

  version: '0.2.0-h5+cloud',
};
