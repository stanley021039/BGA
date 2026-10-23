import { array, record, text } from '../services/validation';
import { isGameType } from './room';
import type { GameType } from './room';
export interface RoomInvitation {
  id: string;
  code: string;
  type: GameType;
  roomName: string;
  fromName: string;
  expiresAt: number;
  canJoin: boolean;
}
export interface InviteCandidate {
  id: string;
  name: string;
  avatar: string;
  pending: boolean;
}
export function readInvitations(value: unknown): RoomInvitation[] {
  return array(record(value).invitations).map((value) => {
    const row = record(value);
    if (
      !text(row.id) ||
      !/^[a-f0-9]{6}$/i.test(text(row.code)) ||
      !isGameType(row.type) ||
      typeof row.expiresAt !== 'number' ||
      !Number.isFinite(row.expiresAt) ||
      typeof row.canJoin !== 'boolean'
    )
      throw Error('房間邀請資料格式不正確。');
    return {
      id: text(row.id),
      code: text(row.code).toUpperCase(),
      type: row.type,
      roomName: text(row.roomName),
      fromName: text(row.fromName),
      expiresAt: row.expiresAt,
      canJoin: row.canJoin,
    };
  });
}
export function readInviteCandidates(value: unknown) {
  const row = record(value);
  if (typeof row.canInvite !== 'boolean') throw Error('線上邀請資料格式不正確。');
  const users = array(row.users).map((value) => {
    const item = record(value);
    if (!text(item.id) || !text(item.name) || typeof item.pending !== 'boolean')
      throw Error('線上朋友資料格式不正確。');
    return {
      id: text(item.id),
      name: text(item.name),
      avatar: text(item.avatar).startsWith('/characters/') ? text(item.avatar) : '',
      pending: item.pending,
    };
  });
  return { canInvite: row.canInvite, reason: text(row.reason), users };
}
export const gameTitles: Record<GameType, string> = {
  poker: '德州撲克',
  thunder: '雷霆之路',
  majority: '同頻俱樂部',
  gift: '送禮達人',
  draw: '你畫我猜',
  telephone: '傳情畫意',
  trpg: '霧港跑團',
  musicquiz: '猜歌挑戰',
  minimal: '極簡猜圖',
  bluff: '瞎掰王',
  quacks: '郎中闖江湖',
  ceo: '王牌執行長',
};
