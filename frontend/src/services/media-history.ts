export interface RecentVideo {
  videoId: string;
  title: string;
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(value);
export function createMediaHistory(storage: StoragePort) {
  let account = '',
    lastPlayback = '',
    rows: RecentVideo[] = [];
  const key = () => 'bga.media.recent.v1:' + account;
  function selectAccount(id: string) {
    if (id === account) return rows;
    account = id;
    lastPlayback = '';
    rows = [];
    if (account)
      try {
        const saved: unknown = JSON.parse(storage.getItem(key()) || '[]');
        if (Array.isArray(saved))
          for (const row of saved.slice(0, 100)) {
            if (
              row &&
              validId(row.videoId) &&
              typeof row.title === 'string' &&
              row.title.trim() &&
              row.title.length <= 500 &&
              !rows.some((item) => item.videoId === row.videoId)
            )
              rows.push({ videoId: row.videoId, title: row.title.trim() });
            if (rows.length === 10) break;
          }
      } catch {
        /* Storage can be unavailable; keep this account in memory. */
      }
    return rows;
  }
  function record(playback: string, value: RecentVideo | null) {
    if (!account || !playback || !value || !validId(value.videoId)) return rows;
    const existing = rows.find((row) => row.videoId === value.videoId);
    const incoming = value.title.trim().slice(0, 500);
    const title =
      !incoming || incoming === `YouTube 影片（${value.videoId}）`
        ? existing?.title || `影片名稱暫時無法取得（${value.videoId}）`
        : incoming;
    const entry = { videoId: value.videoId, title };
    if (playback === lastPlayback && existing?.title === title) return rows;
    if (playback === lastPlayback) {
      rows = rows.map((row) => (row.videoId === entry.videoId ? entry : row));
    } else {
      lastPlayback = playback;
      rows = [entry, ...rows.filter((row) => row.videoId !== entry.videoId)].slice(0, 10);
    }
    try {
      storage.setItem(key(), JSON.stringify(rows));
    } catch {
      /* Memory fallback. */
    }
    return rows;
  }
  return { selectAccount, record };
}
export function recentVideoUrl(videoId: string) {
  return validId(videoId) ? 'https://www.youtube.com/watch?v=' + videoId : '';
}
