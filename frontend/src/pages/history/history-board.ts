import { gameNames } from '../../contracts/history';

export type Data = Record<string, unknown>;
export const obj = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
export const rows = (value: unknown): Data[] => Array.isArray(value) ? value.map(obj) : [];
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const label = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
export const num = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
export interface Cards { text: string; red: boolean }
export interface Piece { text?: string; canvas?: { values: unknown[]; shapes: boolean; label: string } }
export interface Section { title: string; pieces: Piece[]; cards?: Cards[]; color?: string }
export interface Board { title: string; sections: Section[]; players: Section[]; cards: Cards[] }
const section = (title: string, lines: string[], color?: string): Section => ({ title, pieces: lines.map(text => ({ text })), color });
const cardList = (values: unknown): Cards[] => list(values).map(value => {
  const n = num(value), rank = n % 13 + 2, suit = Math.floor(n / 13);
  const face = ({ 11:'J', 12:'Q', 13:'K', 14:'A' } as Record<number, string>)[rank] || String(rank);
  return { text: face + (['♣','♦','♥','♠'][suit] || ''), red: suit === 1 || suit === 2 };
});
const playerName = (players: Data[], id: unknown) => label(players.find(player => player.id === id)?.name, '玩家');
const join = (values: unknown, separator = '、') => list(values).map(value => label(value)).join(separator);

// Read-only view models: archived engine source remains data and is never executed.
export function historyBoard(type: string, state: Data): Board {
  const players = rows(state.players), result = obj(state.result), question = obj(state.question), round = num(state.round);
  const board: Board = { title: '', sections: [], players: [], cards: [] };
  if (type === 'poker') {
    board.title = `第 ${num(state.hand)} 手 · ${label(state.phase)}`; board.cards = cardList(state.board);
    board.sections.push(section('', [`底池 ${players.reduce((sum, player) => sum + num(player.total), 0)}`]));
    board.players = players.map((player, index) => ({ ...section(label(player.name) + (index === state.turn ? ' · 行動中' : ''), [`籌碼 ${num(player.stack)} · 下注 ${num(player.bet)}${player.folded ? ' · 已棄牌' : ''}`]), cards: cardList(player.cards) }));
  } else if (type === 'majority') {
    const phases: Data = { waiting:'等待玩家', choosing:'出題中', answering:'秘密作答', review:'確認分組', reveal:'揭曉', finished:'結束' };
    board.title = `第 ${round} / ${num(state.roundLimit, 10)} 題 · ${label(phases[label(state.phase)] || state.phase)}`;
    board.sections.push(section(label(question.prompt, '尚未出題'), [join(question.options, ' ／ '), ...rows(state.groups).map(group => `${label(group.label)} · ${num(group.count)} 人${group.winner ? ' · 每人 +1' : ''}`)]));
    const answers = obj(state.answers);
    board.players = players.map(player => { const id = label(player.id), answer = answers[id]; return section(label(player.name), [`${num(player.score)} 分${player.id === state.presenterId ? ' · 出題人' : ''}`, '答案：' + (Object.hasOwn(answers, id) ? label(question.type === 'blank' ? answer : list(question.options)[num(answer, -1)]) : '未提交')]); });
  } else if (type === 'gift') {
    const phases: Data = { waiting:'等待玩家', giving:'秘密挑禮物', wishing:'秘密標喜好', reveal:'揭曉', finished:'結束' }, gifts = rows(state.gifts);
    board.title = `第 ${round} 輪 · ${label(phases[label(state.phase)] || state.phase)}`;
    board.sections.push(section('', [`目標 ${num(state.target, 15)} 分`, ...gifts.map((gift, index) => `${index + 1}. ${label(gift.title)}`), ...rows(result.entries).map(entry => `${playerName(players, entry.giverId)} → ${playerName(players, entry.recipientId)}：${label(gifts.find(gift => gift.id === entry.giftId)?.title, '禮物')}（${num(entry.points) > 0 ? '+' : ''}${num(entry.points)}）`)]));
    board.players = players.filter(player => !player.kicked).map(player => section(label(player.name), [`🎁 送禮 ${num(player.giveScore)} ／ ♡ 收禮 ${num(player.getScore)}`]));
  } else if (type === 'draw') {
    const phases: Data = { waiting:'等待玩家', choosing:'選題', drawing:'畫圖與猜題', reveal:'答案揭曉', finished:'結束' };
    board.title = `第 ${round} 輪 · ${label(phases[label(state.phase)] || state.phase)}`;
    board.sections.push(section(label(question.title, '尚未選題'), [`畫者：${playerName(players, state.presenterId)}`, '本作畫過程僅保留在房間記憶體中，歷史保存題目、猜中次序與分數。', ...rows(result.guesses).filter(guess => guess.correct).map(guess => `${label(guess.name)} 猜中 · +${num(guess.points)}`)]));
    board.players = players.filter(player => !player.kicked).map(player => section(label(player.name), [`${num(player.score)} 分`]));
  } else if (type === 'trpg') {
    board.title = `霧港鐘聲 · 第 ${round} 幕`;
    board.sections.push(section('', [`線索 ${num(state.clues)} · 危機 ${num(state.danger)} · 補給 ${num(state.supplies)}`]));
    for (const r of rows(state.results)) board.sections.push(section(label(r.title), [`${label(r.leaderName)}：${num(r.die)} + ${num(r.skill)} + ${num(r.support)} = ${num(r.total)}／${num(r.difficulty)}`, label(r.text), ...rows(r.participants).map(player => `${label(player.name)}：${label(player.note)}`)]));
    board.players = players.map(player => section(label(player.name), [`專注 ${num(player.focus)}`]));
  } else if (type === 'telephone') {
    board.title = gameNames.telephone || '傳情畫意';
    for (const book of rows(state.books)) {
      const pieces: Piece[] = [];
      for (const value of list(book.pages)) {
        if (!value) continue; const page = obj(value);
        pieces.push({ text: label(page.authorName) + '：' + (page.kind === 'text' ? label(page.text) : page.skipped ? '本頁略過' : '畫作') });
        if (page.kind === 'drawing') pieces.push({ canvas: { values: list(page.strokes), shapes: false, label: label(page.authorName) + ' 的畫作' } });
      }
      board.sections.push({ title: label(book.ownerName) + ' 的傳遞簿', pieces });
    }
  } else if (['musicquiz', 'minimal', 'bluff'].includes(type)) {
    board.title = gameNames[type] || type;
    for (const r of rows(state.results)) {
      const pieces: Piece[] = [];
      if (r.answer) {
        pieces.push({ text: `${label(r.answer)} · 老實人：${label(r.honestName)} · 選擇：${label(r.selectedName)}` });
        for (const role of rows(r.roles)) pieces.push({ text: `${label(role.name)} · ${label(role.role)} · ${num(role.delta)} 分` });
      }
      for (const answer of rows(r.answers)) pieces.push({ text: `${label(answer.name)}：${label(answer.text, '略過') || '略過'}${answer.correct ? ' ✓' : ''}` });
      for (const attempt of rows(r.attempts)) pieces.push({ text: `${label(r.guesserName)} 猜 ${label(attempt.text)} · ${label(attempt.artistName)}${attempt.correct ? ' ✓' : '，未猜中'}` });
      for (const drawing of rows(r.drawings)) {
        pieces.push({ text: `${label(drawing.name)} · ${num(drawing.count)} 筆` });
        pieces.push({ canvas: { values: list(drawing.shapes), shapes: true, label: label(drawing.name) + ' 的極簡畫作' } });
      }
      board.sections.push({ title: `${num(r.round)}. ${label(r.title)}`, pieces });
    }
    board.players = players.map(player => section(label(player.name), [`${num(player.score)} 分`]));
  } else if (type === 'quacks') {
    board.title = `郎中闖江湖 · 第 ${round} 回合 · ${label(state.phase)}`;
    board.sections = players.map(player => section(label(player.name), [`${num(player.score)} 分 · ${player.exploded ? '爆炸' : '安全'} · 第 ${num(player.position)} 格`, '藥材：' + rows(player.pot).map(chip => `${label(chip.color)} ${num(chip.value)}`).join('、')]));
  } else if (type === 'thunder') {
    board.title = '歷史賽道';
    board.players = players.map(player => section(label(player.name), [
      `${player.out ? '已出局' : `${num(player.turns)}/3 回合`} · ${player.commandUsed ? '指令已使用' : '指令可用'}`,
      '骰子：' + rows(player.dice).map(die => `${num(die.value)}${die.used ? '✓' : ''}`).join('、'),
      rows(state.cars).filter(car => car.owner === player.id).map(car => `${['輕','中','重'][num(car.size)]}：${car.dead ? '淘汰' : list(car.damage).length + ' 損傷'}`).join(' ／ '),
    ], label(player.color)));
  } else board.title = '此遊戲的視覺回看尚不支援，請查看原始記錄。';
  return board;
}

export function raceBoard(state: Data) {
  const tiles = rows(state.tiles), players = rows(state.players), min = num(tiles[0]?.start), colors: Record<string, string> = { R:'#777869', O:'#b59961', M:'#594431', X:'#675144', G:'#405f32', V:'#377883', J:'#985b32', F:'#a53f23', S:'#b6b6a0' };
  const position = (x: number, y: number) => ({ x: 35 + (y - min) * 32 + (x % 2) * 16, y: 60 + x * 32 });
  const cells: { x: number; y: number; fill: string; symbol: string; title: string }[] = [];
  for (const tile of tiles) for (let x = 0; x < 6; x++) for (let j = 0; j < 8; j++) {
    const cell = obj(list(list(tile.cells)[x])[j]), hazard = obj(cell.hazard);
    cells.push({ ...position(x, num(tile.start) + j), fill: colors[label(cell.kind)] || '#555', symbol: cell.hazard ? hazard.face ? '◆' : '?' : '', title: label(cell.kind) + (cell.hazard ? ` · ${label(hazard.kind)}（${hazard.face ? '已揭露' : '未揭露'}）` : '') });
  }
  const cars = rows(state.cars).filter(car => !car.dead && car.x !== null).map(car => ({ ...position(num(car.x), num(car.y)), color: label(players.find(player => player.id === car.owner)?.color, '#777'), text: car.wreck ? '骸' : ['輕','中','重'][num(car.size)], title: `${label(players.find(player => player.id === car.owner)?.name, '殘骸')} · ${list(car.damage).length} 損傷` }));
  const choppers = players.filter(player => player.chopper).map(player => ({ ...position(num(obj(player.chopper).x), num(obj(player.chopper).y)), color: label(player.color), title: label(player.name) + '的直升機' }));
  return { cells, cars, choppers, finish: state.finishAt !== null && state.finishAt !== undefined, tiles: tiles.map((_, index) => ({ x: 35 + index * 256, title: ['後段','中段','前段'][index] })) };
}
