import type { RoomPlayer, RoomSnapshot } from './room';

export interface SubmissionProgress {
  label: string;
  complete: boolean;
}

// Only public IDs/booleans are read here; answers and vote targets stay private.
export function submissionProgress(s: RoomSnapshot, p: RoomPlayer): SubmissionProgress | null {
  const has = (key: string) => Array.isArray(s[key]) && s[key].includes(p.id);
  const progress = (complete: boolean, done: string, waiting = '等待中') => ({
    complete,
    label: (complete ? done : waiting) + (p.online === false ? ' · 暫時離線' : ''),
  });
  if (s.type === 'majority' && s.phase === 'answering') {
    if (!has('participantIds') || p.waitingForNextRound)
      return { complete: false, label: s.cruel ? '下一局參與' : '下一題參與' };
    return progress(has('answeredIds'), s.tournament ? '已投票 ✓' : '已選擇 ✓');
  }
  if (s.type === 'majority' && s.phase === 'choosing')
    return progress(false, '', p.id === s.presenterId ? '出題人 · 挑題中' : '等待出題');
  if (s.type === 'gift' && s.phase === 'choosing') {
    const gave = has('gaveIds'),
      wished = has('wishedIds');
    return progress(
      gave && wished,
      '已完成選擇 ✓',
      `送禮${gave ? '已選擇' : '等待中'} · 心願${wished ? '已選擇' : '等待中'}`,
    );
  }
  if (s.type === 'telephone' && ['prompting', 'passing'].includes(s.phase))
    return progress(p.ready === true, '已送出 ✓');
  if (s.type === 'minimal' && s.phase === 'drawing')
    return p.id === s.guesserId
      ? { complete: false, label: '本輪猜題者' }
      : progress(has('readyIds'), '已完成作畫 ✓');
  if (s.type === 'bluff' && s.phase === 'preparing') return progress(has('readyIds'), '已準備 ✓');
  if (s.type === 'trpg' && s.phase === 'planning') return progress(p.ready === true, '已準備 ✓');
  if (s.type === 'musicquiz' && s.phase === 'intro') return progress(has('readyIds'), '已選擇 ✓');
  // Challenge submissions expose timeline positions under this game's rules.
  if (s.type === 'musicquiz' && s.phase === 'challenge' && p.id !== s.djId)
    return progress(
      has('passed') || Object.hasOwn((s.challenges || {}) as object, p.id),
      '已完成選擇 ✓',
    );
  return null;
}
