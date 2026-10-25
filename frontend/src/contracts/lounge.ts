import { readRoomSnapshot, type RoomSnapshot } from './room';

function invalid(): never {
  throw Error('場外休憩區房間資料格式不正確。');
}
// 場外休憩區 (#277) has no match state beyond the shared room snapshot.
export function readLoungeSnapshot(value: unknown): RoomSnapshot {
  const room = readRoomSnapshot(value);
  if (room.type !== 'lounge' || room.phase !== 'waiting') return invalid();
  return room;
}
