import { isGameType, type GameType } from './room';
import { readPublicRaceBoard } from './race';
import { readChatMessages, type ChatMessage } from './social';
import { readPokerSnapshot, type PokerSnapshot } from './poker';
import { readCeoSnapshot, type CeoSnapshot } from './ceo';
import { readAthleteSnapshot, type AthleteSnapshot } from './second-wind';
import { readTrpgSnapshot, type TrpgSnapshot } from './trpg';
import { readMinimalSnapshot, type MinimalSnapshot } from './minimal';
import { readDecryptoSnapshot, type DecryptoSnapshot } from './decrypto';
import { readGiftSnapshot, type GiftSnapshot } from './gift';
import { readMajoritySnapshot, type MajoritySnapshot } from './majority';
import { readBluffSnapshot, type BluffSnapshot } from './bluff';
import { readDrawSnapshot, type DrawSnapshot } from './drawing';
import { readTelephoneSnapshot, type TelephoneSnapshot, type TelephoneStroke } from './telephone';
import { readMusicQuizSnapshot, type MusicQuizSnapshot } from './musicquiz';
import {
  ingredientNames,
  readQuacksSnapshot,
  type IngredientColor,
  type QuacksSnapshot,
} from './quacks';
import { record, text } from '../services/validation';

export interface SpectatorShape {
  kind: 'line' | 'circle';
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  r?: number;
}
export interface SpectatorStroke extends TelephoneStroke {
  version?: number;
  strokeId?: string;
  pointTimes?: number[];
  curve?: string;
}
export interface SpectatorSnapshot {
  schema: 1;
  spectator: true;
  code: string;
  type: GameType;
  name: string;
  title: string;
  phase: string;
  phaseLabel: string;
  version: number;
  gameRevision: number;
  serverNow: number;
  round: number;
  roundLimit: number;
  deadline: number | null;
  duration: number;
  players: {
    id: string;
    name: string;
    avatar: string | null;
    host: boolean;
    bot: boolean;
    online: boolean;
    score: number | null;
    status: string;
    lines: string[];
    cards: (number | null)[];
  }[];
  sections: {
    title: string;
    lines: string[];
    items: { label: string; detail: string }[];
    playerId?: string;
  }[];
  cards: (number | null)[];
  drawing: { epoch: string; strokes: SpectatorStroke[] } | null;
  drawings: { title: string; shapes: SpectatorShape[] }[];
  books: {
    ownerId: string;
    ownerName: string;
    pages: {
      kind: 'text' | 'drawing';
      authorName: string;
      text: string;
      skipped: boolean;
      timedOut: boolean;
      strokes: SpectatorStroke[];
    }[];
  }[];
  track: {
    title: string;
    cells: { row: number; column: number; label: string; names: string[] }[];
  } | null;
  raceBoard: ReturnType<typeof readPublicRaceBoard> | null;
  raceDevilsRun: boolean;
  pokerTable: PokerSnapshot | null;
  nativeGame: CeoSnapshot | AthleteSnapshot | null;
  trpgScene: TrpgSnapshot | null;
  minimalScene: MinimalSnapshot | null;
  telephoneScene: TelephoneSnapshot | null;
  decryptoScene: DecryptoSnapshot | null;
  giftScene: GiftSnapshot | null;
  majorityScene: MajoritySnapshot | null;
  bluffScene: BluffSnapshot | null;
  musicScene: MusicQuizSnapshot | null;
  drawScene: DrawSnapshot | null;
  quacksScene: QuacksSnapshot | null;
  musicTimelines: {
    playerId: string;
    cards: { title: string; year: number; artist: string; language?: string }[];
  }[];
  messages: ChatMessage[];
  roomMusic: {
    id: string;
    title: string;
    playing: boolean;
    position: number;
    serverNow: number;
  } | null;
  pots: {
    name: string;
    playerId?: string;
    hidden: boolean;
    position: number | null;
    chips: {
      color: IngredientColor;
      label: string;
      effect: string;
      value: number;
      position?: number;
    }[];
  }[];
  clips: { key: string; label: string; playback: NonNullable<MusicQuizSnapshot['playback']> }[];
  images: { src: string; alt: string }[];
}
function invalid(): never {
  throw Error('觀戰資料格式不正確。');
}
function readRoomMusic(value: unknown): SpectatorSnapshot['roomMusic'] {
  if (value == null) return null;
  const music = record(value);
  if (music.track == null) return null;
  const track = record(music.track);
  if (
    !/^[a-f0-9-]{36}$/i.test(text(track.id)) ||
    !finite(music.position) ||
    !finite(music.serverNow)
  )
    return null;
  return {
    id: text(track.id),
    title: text(track.title),
    playing: music.playing === true,
    position: music.position,
    serverNow: music.serverNow,
  };
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const list = (v: unknown, max = 256) => {
  if (!Array.isArray(v) || v.length > max) return invalid();
  return v;
};
const strings = (v: unknown, max = 256) =>
  list(v, max).map((s) => {
    if (typeof s !== 'string' || s.length > 20000) return invalid();
    return s;
  });
const cards = (v: unknown) =>
  list(v, 5).map((n) => {
    if (n !== null && (!Number.isInteger(n) || (n as number) < 0 || (n as number) > 51))
      return invalid();
    return n as number | null;
  });
function strokes(v: unknown): SpectatorStroke[] {
  let count = 0;
  return list(v, 1000).map((value) => {
    const s = record(value),
      points = list(s.points, 30000);
    count += points.length;
    if (
      count > 30000 ||
      !['brush', 'erase', 'line', 'rect', 'ellipse', 'fill'].includes(text(s.tool)) ||
      !/^#[a-f0-9]{6}$/i.test(text(s.color)) ||
      !finite(s.size) ||
      s.size <= 0 ||
      s.size > 128
    )
      return invalid();
    for (const p of points)
      if (!Array.isArray(p) || p.length !== 2 || !p.every((n) => finite(n) && n >= 0 && n <= 1024))
        return invalid();
    if (
      s.pointTimes !== undefined &&
      (!Array.isArray(s.pointTimes) ||
        s.pointTimes.length !== points.length ||
        !s.pointTimes.every(finite))
    )
      return invalid();
    return {
      tool: s.tool,
      color: s.color,
      size: s.size,
      filled: s.filled === true,
      points,
      ...(Number.isSafeInteger(s.version) ? { version: s.version } : {}),
      ...(typeof s.strokeId === 'string' ? { strokeId: s.strokeId } : {}),
      ...(Array.isArray(s.pointTimes) ? { pointTimes: s.pointTimes } : {}),
      ...(typeof s.curve === 'string' ? { curve: s.curve } : {}),
    } as SpectatorStroke;
  });
}
function shapes(v: unknown): SpectatorShape[] {
  return list(v, 40).map((value) => {
    const s = record(value),
      keys =
        s.kind === 'line' ? ['x1', 'y1', 'x2', 'y2'] : s.kind === 'circle' ? ['cx', 'cy', 'r'] : [];
    if (
      !keys.length ||
      !keys.every((key) => finite(s[key]) && (s[key] as number) >= 0 && (s[key] as number) <= 512)
    )
      return invalid();
    return Object.fromEntries(
      ['kind', ...keys].map((key) => [key, s[key]]),
    ) as unknown as SpectatorShape;
  });
}
export function readSpectatorSnapshot(value: unknown): SpectatorSnapshot {
  const s = record(value);
  if (
    s.schema !== 1 ||
    s.spectator !== true ||
    !isGameType(s.type) ||
    !/^[a-f\d]{6}$/i.test(text(s.code)) ||
    !text(s.title) ||
    !text(s.phase) ||
    !finite(s.serverNow) ||
    !finite(s.gameRevision) ||
    !finite(s.duration) ||
    s.duration <= 0 ||
    (s.deadline !== null && !finite(s.deadline))
  )
    return invalid();
  const result: SpectatorSnapshot = {
    schema: 1,
    spectator: true,
    code: text(s.code),
    type: s.type,
    name: text(s.name),
    title: text(s.title),
    phase: text(s.phase),
    phaseLabel: text(s.phaseLabel),
    version: Number(s.version),
    gameRevision: s.gameRevision,
    serverNow: s.serverNow,
    round: Number(s.round),
    roundLimit: Number(s.roundLimit),
    deadline: s.deadline as number | null,
    duration: s.duration,
    players: list(s.players, 12).map((v) => {
      const p = record(v);
      if (
        !/^observer-(?:\d+|[a-f0-9]{24})$/.test(text(p.id)) ||
        !text(p.name) ||
        (p.score !== null && !finite(p.score))
      )
        return invalid();
      return {
        id: text(p.id),
        name: text(p.name),
        avatar: typeof p.avatar === 'string' ? p.avatar : null,
        host: p.host === true,
        bot: p.bot === true,
        online: p.online === true,
        score: p.score as number | null,
        status: text(p.status),
        lines: strings(p.lines, 20),
        cards: cards(p.cards),
      };
    }),
    sections: list(s.sections, 80).map((v) => {
      const r = record(v);
      return {
        title: text(r.title),
        playerId: text(r.playerId) || undefined,
        lines: strings(r.lines, 60),
        items: list(r.items, 256).map((v) => {
          const i = record(v);
          return { label: text(i.label), detail: text(i.detail) };
        }),
      };
    }),
    cards: cards(s.cards),
    drawing: null,
    images: list(s.images, 3).map((v) => {
      const image = record(v);
      if (!/^\/assets\/[a-z0-9/_-]+\.(?:svg|webp|png|jpe?g)$/i.test(text(image.src)))
        return invalid();
      return { src: text(image.src), alt: text(image.alt) };
    }),
    drawings: list(s.drawings, 8).map((v) => {
      const d = record(v);
      return { title: text(d.title), shapes: shapes(d.shapes) };
    }),
    books: list(s.books, 8).map((v) => {
      const b = record(v);
      return {
        ownerId: text(b.ownerId),
        ownerName: text(b.ownerName),
        pages: list(b.pages, 9).map((v) => {
          const p = record(v);
          if (!['text', 'drawing'].includes(text(p.kind))) return invalid();
          return {
            kind: p.kind as 'text' | 'drawing',
            authorName: text(p.authorName),
            text: text(p.text),
            skipped: p.skipped === true,
            timedOut: p.timedOut === true,
            strokes: strokes(p.strokes),
          };
        }),
      };
    }),
    track: null,
    raceDevilsRun: s.raceDevilsRun === true,
    pokerTable: null,
    nativeGame: null,
    trpgScene: null,
    minimalScene: null,
    telephoneScene: null,
    decryptoScene: null,
    giftScene: null,
    majorityScene: null,
    bluffScene: null,
    musicScene: null,
    drawScene: null,
    quacksScene: null,
    musicTimelines:
      s.musicTimelines === undefined
        ? []
        : list(s.musicTimelines, 12).map((value) => {
            const timeline = record(value);
            return {
              playerId: text(timeline.playerId),
              cards: list(timeline.cards, 100).map((value) => {
                const card = record(value);
                if (!text(card.title) || !finite(card.year)) return invalid();
                return {
                  title: text(card.title),
                  year: card.year,
                  artist: text(card.artist),
                  language: text(card.language) || undefined,
                };
              }),
            };
          }),
    messages: s.messages === undefined ? [] : readChatMessages(s.messages),
    roomMusic: readRoomMusic(s.roomMusic),
    raceBoard:
      s.type === 'thunder' && s.raceBoard != null
        ? readPublicRaceBoard(s.raceBoard, text(s.phase))
        : null,
    pots: list(s.pots, 8).map((v) => {
      const p = record(v);
      return {
        name: text(p.name),
        hidden: p.hidden === true,
        playerId: text(p.playerId) || undefined,
        position: p.position === null ? null : Number(p.position),
        chips: list(p.chips, 300).map((v) => {
          const c = record(v);
          if (!finite(c.value) || !Object.hasOwn(ingredientNames, text(c.color))) return invalid();
          return {
            color: text(c.color) as IngredientColor,
            label: text(c.label),
            effect: text(c.effect),
            value: c.value,
            ...(finite(c.position) ? { position: c.position } : {}),
          };
        }),
      };
    }),
    clips: list(s.clips, 2).map((v) => {
      const c = record(v),
        p = record(c.playback);
      if (
        !['audio', 'youtube'].includes(text(p.provider)) ||
        !finite(p.start) ||
        !finite(p.seconds) ||
        p.seconds <= 0 ||
        p.seconds > 30 ||
        !['intro', 'highlight'].includes(text(p.stage))
      )
        return invalid();
      if (
        p.provider === 'audio'
          ? !text(p.url).startsWith('/api/watch-audio?')
          : !/^[\w-]{11}$/.test(text(p.videoId))
      )
        return invalid();
      return {
        key: text(c.key),
        label: text(c.label),
        playback: p as unknown as NonNullable<MusicQuizSnapshot['playback']>,
      };
    }),
  };
  if (s.drawing !== null) {
    const d = record(s.drawing);
    if (!text(d.epoch)) return invalid();
    result.drawing = { epoch: text(d.epoch), strokes: strokes(d.strokes) };
  }
  if (s.track !== null) {
    const t = record(s.track);
    result.track = {
      title: text(t.title),
      cells: list(t.cells, 1024).map((v) => {
        const c = record(v);
        if (
          !Number.isSafeInteger(c.row) ||
          !Number.isSafeInteger(c.column) ||
          Number(c.row) < 0 ||
          Number(c.row) > 6
        )
          return invalid();
        return {
          row: Number(c.row),
          column: Number(c.column),
          label: text(c.label),
          names: strings(c.names, 50),
        };
      }),
    };
  }
  if (result.type === 'poker' && s.pokerTable != null) {
    const table = record(s.pokerTable);
    const seats = list(table.players, 8).map((seat) => record(seat));
    result.pokerTable = readPokerSnapshot(
      {
        ...table,
        code: result.code,
        type: result.type,
        phase: result.phase,
        serverNow: result.serverNow,
        deadline: result.deadline,
        host: false,
        me: 'observer',
        board: result.cards,
        canRaise: false,
        log: [],
        players: result.players.map((player) => ({
          ...seats.find((seat) => seat.id === player.id),
          ...player,
          roomRole: null,
          kicked: false,
        })),
      },
      true,
    );
  }
  if ((result.type === 'ceo' || result.type === 'second-wind') && s.nativeGame !== undefined) {
    const snapshot = {
      code: result.code,
      type: result.type,
      phase: result.phase,
      serverNow: result.serverNow,
      roundId: String(result.gameRevision),
      host: false,
      me: 'observer',
      game: s.nativeGame,
      options: s.nativeGameOptions,
      players: result.players.map((player) => ({ ...player, roomRole: null, kicked: false })),
    };
    result.nativeGame =
      result.type === 'ceo' ? readCeoSnapshot(snapshot) : readAthleteSnapshot(snapshot);
  }
  if (result.type === 'trpg' && s.trpgScene != null) {
    const scene = record(s.trpgScene);
    const seats = list(scene.players, 8).map((seat) => record(seat));
    result.trpgScene = readTrpgSnapshot({
      ...scene,
      code: result.code,
      type: result.type,
      phase: result.phase,
      serverNow: result.serverNow,
      host: false,
      me: 'observer',
      players: result.players.map((player) => ({
        ...seats.find((seat) => seat.id === player.id),
        ...player,
        roomRole: null,
        kicked: false,
      })),
    });
  }
  if (result.type === 'minimal' && s.minimalScene != null) {
    result.minimalScene = readMinimalSnapshot(
      {
        ...record(s.minimalScene),
        code: result.code,
        type: result.type,
        phase: result.phase,
        serverNow: result.serverNow,
        host: false,
        me: 'observer',
        prompt: null,
        myShapes: [],
        submitted: false,
        players: result.players.map((player) => ({ ...player, roomRole: null, kicked: false })),
      },
      true,
    );
  }
  if (result.type === 'telephone' && s.telephoneScene != null) {
    result.telephoneScene = readTelephoneSnapshot({
      ...record(s.telephoneScene),
      code: result.code,
      type: result.type,
      phase: result.phase,
      serverNow: result.serverNow,
      host: false,
      me: 'observer',
      spectator: true,
      task: null,
      players: result.players.map((player) => ({ ...player, roomRole: null, kicked: false })),
    });
  }
  if (result.type === 'decrypto' && s.decryptoScene != null) {
    result.decryptoScene = readDecryptoSnapshot({
      ...record(s.decryptoScene),
      code: result.code,
      type: result.type,
      phase: result.phase,
      serverNow: result.serverNow,
      host: false,
      me: 'observer',
      myTeam: 0,
      secretCode: null,
      myGuess: null,
      players: result.players.map((player) => ({ ...player, roomRole: null, kicked: false })),
    });
  }
  if (result.type === 'gift' && s.giftScene != null) {
    const scene = record(s.giftScene);
    const seats = list(scene.players, 8).map((seat) => record(seat));
    result.giftScene = readGiftSnapshot({
      ...scene,
      code: result.code,
      type: result.type,
      phase: result.phase,
      serverNow: result.serverNow,
      host: false,
      me: 'observer',
      ownAssignments: null,
      ownRanking: null,
      players: result.players.map((player) => ({
        ...seats.find((seat) => seat.id === player.id),
        ...player,
        roomRole: null,
        kicked: false,
      })),
    });
  }
  if (result.type === 'majority' && s.majorityScene != null) {
    result.majorityScene = readMajoritySnapshot({
      ...record(s.majorityScene),
      code: result.code,
      type: result.type,
      phase: result.phase,
      serverNow: result.serverNow,
      host: false,
      me: 'observer',
      ownQueue: [],
      candidates: [],
      topics: [],
      queueCount: 0,
      players: result.players.map((player) => ({ ...player, roomRole: null, kicked: false })),
    });
  }
  if (result.type === 'bluff' && s.bluffScene != null) {
    result.bluffScene = readBluffSnapshot({
      ...record(s.bluffScene),
      code: result.code,
      type: result.type,
      phase: result.phase,
      serverNow: result.serverNow,
      host: false,
      me: 'observer',
      players: result.players.map((player) => ({ ...player, roomRole: null, kicked: false })),
    });
  }
  if (result.type === 'musicquiz' && s.musicScene != null) {
    const scene = record(s.musicScene);
    const seats = list(scene.players, 8).map((seat) => record(seat));
    result.musicScene = readMusicQuizSnapshot(
      {
        ...scene,
        code: result.code,
        type: result.type,
        phase: result.phase,
        serverNow: result.serverNow,
        host: false,
        me: 'observer',
        events: [],
        myAnswer: null,
        submitted: false,
        passed: [],
        banks: [],
        genres: [],
        customSongs: [],
        mine: { tokens: 0, bonus: 0, timeline: [] },
        playback: result.clips[0]?.playback ?? null,
        players: result.players.map((player) => ({
          ...seats.find((seat) => seat.id === player.id),
          ...player,
          roomRole: null,
          kicked: false,
        })),
      },
      true,
    );
  }
  if (result.type === 'draw' && s.drawScene != null) {
    result.drawScene = readDrawSnapshot({
      ...record(s.drawScene),
      code: result.code,
      type: result.type,
      phase: result.phase,
      serverNow: result.serverNow,
      version: result.gameRevision,
      host: false,
      me: 'observer',
      candidates: [],
      recentResults: [],
      resultVotes: [],
      savedResultIds: [],
      players: result.players.map((player) => ({ ...player, roomRole: null, kicked: false })),
    });
  }
  if (result.type === 'quacks' && s.quacksScene != null) {
    result.quacksScene = readQuacksSnapshot(
      {
        ...record(s.quacksScene),
        code: result.code,
        type: result.type,
        phase: result.phase,
        serverNow: result.serverNow,
        host: false,
        me: 'observer',
        mine: null,
        patients: [],
        rollEvents: [],
        events: [],
        players: result.players.map((player) => ({ ...player, roomRole: null, kicked: false })),
      },
      true,
    );
  }
  return result;
}
