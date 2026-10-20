import type { DrawSnapshot } from '../../contracts/drawing';
import type { RoomPlayer } from '../../contracts/room';
export const drawPhases = {
  waiting: '等待玩家',
  choosing: '畫者選題',
  drawing: '畫圖與猜題',
  reveal: '答案揭曉',
  finished: '本局結束',
} as const;
export function drawPlayerStatus(
  player: RoomPlayer,
  state: DrawSnapshot,
  disconnected = false,
): string {
  const didNotPlay =
    ['reveal', 'finished'].includes(state.phase) &&
    player.id !== state.presenterId &&
    !state.participantIds.includes(player.id);
  let status = didNotPlay
    ? '本輪未參與'
    : player.waitingForNextRound
      ? '下輪加入'
      : player.id === state.presenterId
        ? state.phase === 'choosing'
          ? '選題中'
          : state.phase === 'drawing'
            ? '畫圖中'
            : '本輪畫者'
        : state.guessedIds.includes(player.id)
          ? '已猜中'
          : state.phase === 'waiting'
            ? player.ready
              ? '已就緒'
              : '已入座'
            : '尚未猜中';
  if (state.phase === 'waiting' && player.id === state.hostId) status = '房主 · ' + status;
  if (player.id === state.me && disconnected) status += ' · 正在重連';
  else if (!player.online) status += ' · 暫時離線';
  return status;
}
export function drawWaitingSummary(state: DrawSnapshot | null): string {
  const artist = state?.players.find((player) => player.id === state.presenterId);
  return state && ['choosing', 'drawing'].includes(state.phase) && artist?.online === false
    ? `${artist.name} 暫時離線，正在重新連線；倒數仍照常進行。`
    : '';
}
