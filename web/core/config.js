export const CONFIG = {
  // 部署 Cloudflare Worker 后把地址填在这里，例如：
  //   https://wanxiang-wish.<你的账号>.workers.dev
  // 留空 + forceLocal=false 时自动退回本地 Mock 掷骰（数据只存本机）。
  apiBase: '',

  // 调试用：置 true 可强制离线模式，忽略 apiBase。
  forceLocal: false,

  version: '0.2.0-h5',
};
