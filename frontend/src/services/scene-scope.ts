export function sceneApiPath(path: string) {
  if (location.pathname !== '/arena' || !path.startsWith('/api/lobby')) return path;
  const scope = new URLSearchParams(location.search).has('training') ? 'training' : 'arena';
  return path + (path.includes('?') ? '&' : '?') + scope + '=1';
}
