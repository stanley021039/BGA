import { array, number, record, strings, text } from '../services/validation';

export const gameNames: Readonly<Record<string, string>> = {
  quacks: '郎中闖江湖',
  ceo: '王牌執行長',
  'second-wind': '運動員 Second Wind',
  bluff: '瞎掰王',
  thunder: '雷霆之路',
  poker: '德州撲克',
  majority: '同頻俱樂部',
  gift: '送禮達人',
  draw: '你畫我猜',
  trpg: '霧港跑團',
  telephone: '傳情畫意',
  musicquiz: '猜歌挑戰',
  minimal: '極簡畫家',
};
export const historyStatuses: Readonly<Record<string, string>> = {
  playing: '進行中',
  finished: '已結束',
  interrupted: '中斷存檔',
};
const actions: Readonly<Record<string, string>> = {
  kick: '房主踢出玩家',
  enqueue: '預備題目',
  unqueue: '移除預備題目',
  withdraw: '收回答案',
  react: '送出表情',
  draw: '抽題',
  ask: '出題',
  answer: '提交答案',
  close: '結束作答',
  score: '計分',
  merge: '合併同義答案',
  resetGroups: '還原分組',
  pass: '更換出題人',
  next: '下一題',
  start: '開局',
  begin: '分配車輛與骰子',
  move: '移動',
  moveEffect: '結算位移',
  resolveSlam: '結算碰撞',
  damage: '結算損傷',
  endTurn: '回合結束',
  newRound: '新一輪',
  finish: '結算',
  advance: '推進牌局',
  showdown: '攤牌',
  auto: '自動操作',
  fold: '棄牌',
  call: '跟注',
  check: '過牌',
  raise: '加注',
  allin: '全押',
  shoot: '射擊',
  slam: '碰撞選擇',
  bonus: '公路加速',
  airplace: '部署直升機',
};
const sources: Readonly<Record<string, string>> = {
  player: '玩家',
  bot: '電腦',
  timeout: '逾時代操作',
};
export interface HistoryMatch {
  id: string;
  type: string;
  name: string;
  status: string;
  startedAt: string;
  players: string[];
}
export interface HistoryFrame {
  label: string;
  state: Record<string, unknown>;
  record: Record<string, unknown>;
}
export interface HistoryReplay {
  records: unknown[];
  frames: HistoryFrame[];
}
export function readMatches(value: unknown): HistoryMatch[] {
  return array(value).map((value) => {
    const row = record(value);
    if (!text(row.id) || !text(row.type)) throw Error('歷史對局資料格式不正確');
    return {
      id: text(row.id),
      type: text(row.type),
      name: text(row.name),
      status: text(row.status),
      startedAt: text(row.startedAt),
      players: strings(row.players),
    };
  });
}
export function readReplay(value: unknown, type: string): HistoryReplay {
  const records = array(value),
    rows = records.map((value) => record(value)),
    header = rows.find((row) => row.kind === 'header');
  if (!header) throw Error('存檔缺少開局記錄，無法回看');
  const frames: HistoryFrame[] = [
    {
      label: '開局前',
      state: record(header.initial),
      record: { schema: header.schema, engineHash: record(header.engine).sha256 },
    },
  ];
  for (const row of rows.filter((row) => row.kind === 'result')) {
    for (const value of Array.isArray(row.trace) ? row.trace : []) {
      const trace = record(value);
      if (trace.state)
        frames.push({
          label: `${number(row.seq)} · ${actions[text(trace.method)] || text(trace.method)}`,
          state: record(trace.state),
          record: trace,
        });
    }
    const operation = record(row.operation),
      input = operation.input && typeof operation.input === 'object' ? record(operation.input) : {};
    frames.push({
      label: `${number(row.seq)} · ${sources[text(operation.source)] || text(operation.source)} · ${actions[text(input.action) || text(operation.action)] || text(operation.action)}${row.ok ? '' : '（失敗）'}`,
      state: record(row.after),
      record: row,
    });
  }
  if (type === 'telephone') hydrateBooks(frames);
  return { records, frames };
}
function hydrateBooks(frames: HistoryFrame[]) {
  let run: unknown = Symbol(),
    books: Record<string, unknown>[] = [];
  for (const frame of frames) {
    const state = frame.state;
    if (state.runId !== run) {
      run = state.runId;
      books = (Array.isArray(state.bookHeaders) ? state.bookHeaders : []).map((value) =>
        structuredClone(record(value)),
      );
    }
    for (const value of Array.isArray(state.pageCommits) ? state.pageCommits : []) {
      const commit = record(value),
        index = number(commit.bookIndex, -1),
        round = number(commit.round, -1),
        book = books[index];
      if (!book || !Number.isInteger(round) || round < 0 || round > 1000) continue;
      if (!Array.isArray(book.pages)) book.pages = [];
      (book.pages as unknown[])[round] = commit.page;
    }
    frame.state = { ...state, books: structuredClone(books) };
  }
}
