import AudioSettings from '../engines/audio-settings.js';
import type { RoomSeat } from '../contracts/room';

const entryKey = 'bga-action-feedback-room-entry';

export function playActionFeedback(kind: 'confirm' | 'ready' = 'confirm') {
  return AudioSettings?.playEffect?.(kind === 'ready' ? 'turn' : 'quacks-buy');
}

export function rememberRoomEntryFeedback(seat: RoomSeat) {
  if (seat.reconnected || document.hidden) return;
  try {
    sessionStorage.setItem(
      entryKey,
      JSON.stringify({ code: seat.code, type: seat.type, at: Date.now() }),
    );
  } catch {
    // Storage may be unavailable in a private browser.
  }
}

export function playRoomEntryFeedback(seat: RoomSeat) {
  try {
    const stored = sessionStorage.getItem(entryKey);
    if (!stored) return;
    sessionStorage.removeItem(entryKey);
    const entry = JSON.parse(stored);
    const age = Date.now() - entry.at;
    if (entry.code === seat.code && entry.type === seat.type && age >= 0 && age <= 15000)
      playActionFeedback();
  } catch {
    // Room access must work even if storage or audio is unavailable.
  }
}
