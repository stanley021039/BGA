import { array, record, text, strings } from '../services/validation';
import { readRoomSnapshot, type RoomSnapshot, type RoomPlayer } from './room';
export interface MusicCard {
  id: string;
  title: string;
  language?: string;
  artist: string;
  year: number;
}
export interface MusicAnswer {
  id: string;
  name: string;
  choiceId: string | null;
  text: string;
  titleCorrect: boolean;
  bonus: number;
  tokenEarned: boolean;
}
export interface MusicRound extends MusicCard {
  round: number;
  answers: MusicAnswer[];
  djId: string;
  djCorrect: boolean;
  receiverId: string | null;
  receiverName: string | null;
  challenges: Record<string, number>;
}
export interface MusicPlayer extends RoomPlayer {
  timeline: MusicCard[];
  tokens: number;
  bonus: number;
  musicCardFrame: { id: string; kind: 'builtin'; version: 1 };
}
export interface MusicQuizSnapshot extends RoomSnapshot {
  type: 'musicquiz';
  phase: 'waiting' | 'pick' | 'intro' | 'timeline' | 'challenge' | 'reveal' | 'finished';
  round: number;
  roundId: string | null;
  roundLimit: number;
  players: MusicPlayer[];
  interrupted: boolean;
  submitted: boolean;
  myAnswer: { text: string; choiceId: string | null; titleCorrect: boolean | null } | null;
  readyIds: string[];
  djId: string | null;
  deadline: number | null;
  introChoices: { id: string; title: string; language?: string }[];
  placement: number | null;
  challenges: Record<string, number>;
  passed: string[];
  song: MusicCard | null;
  results: MusicRound[];
  winner: { score: number; names: string[] } | null;
  settings: {
    banks: string[];
    genres: string[];
    target: number;
    introSeconds: number;
    obscure: boolean;
  };
  banks: { id: string; label: string; count: number }[];
  genres: string[];
  customSongs: Record<string, unknown>[];
  availableCount: number;
  mine: { tokens: number; bonus: number; timeline: MusicCard[] };
  playback: {
    provider: 'audio' | 'youtube';
    url?: string;
    videoId?: string;
    start: number;
    seconds: number;
    stage: 'intro' | 'highlight';
  } | null;
}
function number(v: unknown) {
  if (!Number.isFinite(v) || typeof v !== 'number') throw Error('猜歌數值格式不正確');
  return v;
}
function card(v: unknown): MusicCard {
  const s = record(v);
  if (!text(s.title) || !text(s.artist) || !Number.isInteger(s.year))
    throw Error('歌曲資料格式不正確');
  return {
    id: text(s.id),
    title: text(s.title),
    language: text(s.language),
    artist: text(s.artist),
    year: number(s.year),
  };
}
export function readMusicQuizSnapshot(value: unknown): MusicQuizSnapshot {
  const room = readRoomSnapshot(value),
    r = record(value),
    settings = record(r.settings),
    mine = record(r.mine);
  if (
    room.type !== 'musicquiz' ||
    !['waiting', 'pick', 'intro', 'timeline', 'challenge', 'reveal', 'finished'].includes(
      room.phase,
    )
  )
    throw Error('猜歌房間資料格式不正確');
  const media = r.playback ? record(r.playback) : null;
  let playback: MusicQuizSnapshot['playback'] = null;
  if (media) {
    if (
      !['audio', 'youtube'].includes(String(media.provider)) ||
      !['intro', 'highlight'].includes(String(media.stage))
    )
      throw Error('歌曲播放格式不正確');
    if (media.provider === 'audio') {
      const u = new URL(text(media.url), 'http://afterhours.invalid');
      if (
        !text(media.url).startsWith('/api/game-song-audio?') ||
        u.pathname !== '/api/game-song-audio' ||
        u.searchParams.get('code')?.toUpperCase() !== room.code ||
        u.searchParams.get('roundId') !== r.roundId
      )
        throw Error('歌曲來源不正確');
    } else if (!/^[\w-]{11}$/.test(text(media.videoId))) throw Error('影片來源不正確');
    playback = {
      provider: media.provider as 'audio' | 'youtube',
      url: typeof media.url === 'string' ? media.url : undefined,
      videoId: typeof media.videoId === 'string' ? media.videoId : undefined,
      start: number(media.start),
      seconds: number(media.seconds),
      stage: media.stage as 'intro' | 'highlight',
    };
  }
  return {
    ...room,
    type: 'musicquiz',
    phase: room.phase as MusicQuizSnapshot['phase'],
    round: number(r.round),
    roundLimit: number(r.roundLimit),
    roundId: r.roundId === null ? null : text(r.roundId),
    interrupted: r.interrupted === true,
    submitted: r.submitted === true,
    myAnswer: r.myAnswer
      ? {
          titleCorrect:
            typeof record(r.myAnswer).titleCorrect === 'boolean'
              ? (record(r.myAnswer).titleCorrect as boolean)
              : null,
          text: text(record(r.myAnswer).text),
          choiceId:
            typeof record(r.myAnswer).choiceId === 'string'
              ? String(record(r.myAnswer).choiceId)
              : null,
        }
      : null,
    readyIds: strings(r.readyIds),
    djId: typeof r.djId === 'string' ? r.djId : null,
    deadline: r.deadline === null ? null : number(r.deadline),
    introChoices: array(r.introChoices).map((v) => ({
      id: text(record(v).id),
      title: text(record(v).title),
      language: text(record(v).language),
    })),
    placement: r.placement === null ? null : number(r.placement),
    challenges: record(r.challenges) as Record<string, number>,
    passed: strings(r.passed),
    song: r.song ? card(r.song) : null,
    results: array(r.results) as unknown as MusicRound[],
    winner: r.winner
      ? { score: number(record(r.winner).score), names: strings(record(r.winner).names) }
      : null,
    players: room.players.map((p) => ({
      ...p,
      timeline: array(p.timeline).map(card),
      tokens: number(p.tokens),
      bonus: number(p.bonus),
      musicCardFrame: p.musicCardFrame as MusicPlayer['musicCardFrame'],
    })),
    settings: {
      banks: strings(settings.banks),
      genres: strings(settings.genres),
      target: number(settings.target),
      introSeconds: number(settings.introSeconds),
      obscure: settings.obscure === true,
    },
    banks: array(r.banks).map((v) => ({
      id: text(record(v).id),
      label: text(record(v).label),
      count: number(record(v).count),
    })),
    genres: strings(r.genres),
    customSongs: array(r.customSongs).map((v) => record(v)),
    availableCount: number(r.availableCount),
    mine: {
      tokens: number(mine.tokens),
      bonus: number(mine.bonus),
      timeline: array(mine.timeline).map(card),
    },
    playback,
  };
}
