// 极简 hash 路由。改 location.hash 会自然触发 hashchange，由 app.js 统一重渲染。
export function go(route, params) {
  const qs =
    params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
  location.hash = `#/${route}${qs}`;
}

export function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const qIdx = raw.indexOf('?');
  const route = (qIdx === -1 ? raw : raw.slice(0, qIdx)) || 'gallery';
  const params = new URLSearchParams(qIdx === -1 ? '' : raw.slice(qIdx + 1));
  return { route, params };
}

export function replace(route, params) {
  const qs =
    params && Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
  history.replaceState(null, '', `#/${route}${qs}`);
}
