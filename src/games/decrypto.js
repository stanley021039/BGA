'use strict';
const { randomUUID } = require('node:crypto');
const { PartyRoom, fail, clone, text, normalize } = require('./party-base');
const { WORDS } = require('./decrypto-catalog');
const TEAM_NAMES = ['白隊', '黑隊'];
const CODES = [];
for (let a = 1; a <= 4; a++)
  for (let b = 1; b <= 4; b++)
    for (let c = 1; c <= 4; c++) if (new Set([a, b, c]).size === 3) CODES.push([a, b, c]);
function code(value) {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((n) => !Number.isInteger(n) || n < 1 || n > 4) ||
    new Set(value).size !== 3
  )
    fail('INVALID_CODE', '密碼須為三個不重複的 1–4 數字', 400);
  return value.slice();
}
class DecryptoRoom extends PartyRoom {
  constructor(code, name, rng, now) {
    super('decrypto', code, name, 8, 4, rng, now);
    this.teams = [
      { members: [], interceptions: 0, failures: 0 },
      { members: [], interceptions: 0, failures: 0 },
    ];
    this.keywords = [[], []];
    this.codes = [null, null];
    this.clues = [null, null];
    this.decks = [[], []];
    this.encryptors = [];
    this.decoders = [];
    this.usedClues = [];
    this.guesses = {};
    this.turn = 0;
    this.tieGuesses = {};
    this.roundLimit = 8;
    this.deadline = null;
  }
  teamOf(id) {
    return this.teams.findIndex((t) => t.members.includes(id));
  }
  add(name, bot = false) {
    const p = super.add(name, bot);
    this.assignTeam(p);
    return p;
  }
  assignTeam(p) {
    this.teams.forEach((t) => (t.members = t.members.filter((id) => this.player(id))));
    if (this.teamOf(p.id) >= 0 && this.teams[this.teamOf(p.id)].members.length <= 4) return;
    this.teams.forEach((t) => (t.members = t.members.filter((id) => id !== p.id)));
    const counts = this.teams.map((t) => t.members.filter((id) => this.player(id)).length);
    this.teams[counts[0] <= counts[1] ? 0 : 1].members.push(p.id);
  }
  assign(id, team) {
    if (!['waiting', 'finished'].includes(this.phase)) fail('MATCH_STARTED', '開局後不能換隊');
    if (![0, 1].includes(team)) fail('INVALID_TEAM', '請選白隊或黑隊', 400);
    if (this.teamOf(id) === team) return;
    if (this.teams[team].members.filter((id) => this.player(id)).length >= 4)
      fail('TEAM_FULL', '每隊最多 4 人');
    this.teams.forEach((t) => (t.members = t.members.filter((n) => n !== id)));
    this.teams[team].members.push(id);
    this.event('team', this.player(id).name + ' 加入' + TEAM_NAMES[team]);
  }
  index(n) {
    const x = this.rng(n);
    if (!Number.isInteger(x) || x < 0 || x >= n) throw Error('無效抽樣');
    return x;
  }
  start() {
    if (!['waiting', 'finished'].includes(this.phase)) fail('MATCH_STARTED', '遊戲已開始');
    const members = this.teams.map((t) => t.members.filter((id) => this.player(id)));
    if (members.some((m) => m.length < 2 || m.length > 4))
      fail('NEED_TEAMS', '需要兩隊，每隊 2–4 人', 400);
    const pool = [...WORDS],
      keywords = [[], []];
    for (const team of keywords)
      for (let i = 0; i < 4; i++) team.push(pool.splice(this.index(pool.length), 1)[0]);
    this.prepare();
    this.teams = members.map((m) => ({ members: m, interceptions: 0, failures: 0 }));
    this.keywords = keywords;
    this.usedClues = [];
    this.decks = [[], []];
    this.tieGuesses = {};
    this.nextRound();
  }
  nextRound() {
    this.round++;
    this.roundId = randomUUID();
    this.turn = 0;
    this.encryptors = this.teams.map((t) => t.members[(this.round - 1) % t.members.length]);
    this.decoders = this.teams.map((t) => t.members[this.round % t.members.length]);
    // Official decks are reshuffled after every round: a code may repeat.
    this.codes = [0, 1].map(() => CODES[this.index(CODES.length)].slice());
    this.clues = [null, null];
    this.guesses = {};
    this.phase = 'clues';
    this.event('round', '第 ' + this.round + ' 輪：雙方出題者準備三條線索。');
  }
  act(id, action, data = {}) {
    return this.command(id, action, data, () => {
      const team = this.teamOf(id);
      if (['decode', 'intercept', 'next'].includes(action) && data.turn !== this.turn)
        fail('STALE_TURN', '通訊回合已更新，請重新查看畫面');
      if (action === 'team') {
        this.assign(id, data.team);
        return;
      }
      if (action === 'clues') {
        if (this.phase !== 'clues') fail('INVALID_PHASE', '現在不能出題');
        if (this.encryptors[team] !== id) fail('ENCRYPTOR_ONLY', '只有本輪出題者可以送出線索', 403);
        if (this.clues[team]) fail('ALREADY_SUBMITTED', '線索已鎖定');
        if (!Array.isArray(data.clues) || data.clues.length !== 3)
          fail('INVALID_CLUES', '請填寫三條線索', 400);
        const clues = data.clues.map((s) => text(s, 40)),
          normalized = clues.map(normalize);
        if (normalized.some((s) => !s) || new Set(normalized).size !== 3)
          fail('INVALID_CLUES', '三條線索必須非空且不重複', 400);
        const forbidden = this.keywords[team].map(normalize);
        if (
          normalized.some((s) => this.usedClues.includes(s) || forbidden.some((w) => s.includes(w)))
        )
          fail('INVALID_CLUES', '不能重用已公布線索或直接包含己方關鍵詞', 400);
        this.clues[team] = clues;
        if (this.clues.every(Boolean)) {
          // Reserve together: simultaneous duplicates across teams are harmless;
          // checking only published earlier rounds prevents an information oracle.
          this.usedClues.push(...this.clues.flat().map(normalize));
          this.phase = 'guessing';
        }
        this.event('clues', TEAM_NAMES[team] + '線索已鎖定。');
      } else if (action === 'decode' || action === 'intercept') {
        if (this.phase !== 'guessing') fail('INVALID_PHASE', '現在不能猜碼');
        const target = action === 'decode' ? this.turn : 1 - this.turn;
        if (team !== target || this.decoders[team] !== id)
          fail('DECODER_ONLY', '由該隊本輪猜碼代表確認答案', 403);
        if (action === 'intercept' && this.round === 1)
          fail('NO_FIRST_INTERCEPTION', '第一輪不進行截碼');
        if (this.guesses[action]) fail('ALREADY_SUBMITTED', '答案已鎖定');
        this.guesses[action] = code(data.digits);
        this.event('guess', TEAM_NAMES[team] + '已鎖定答案。');
        if (this.guesses.decode && (this.round === 1 || this.guesses.intercept)) this.reveal();
      } else if (action === 'next') {
        if (id !== this.host) fail('HOST_ONLY', '只有房主可以繼續', 403);
        if (this.phase !== 'reveal') fail('INVALID_PHASE', '揭曉後才能繼續');
        if (this.turn === 0) {
          this.turn = 1;
          this.guesses = {};
          this.phase = 'guessing';
          this.event('turn', '換黑隊通訊。');
        } else if (!this.resolveRound()) this.nextRound();
      } else if (action === 'keywords') {
        if (this.phase !== 'tiebreak') fail('INVALID_PHASE', '現在不能猜關鍵詞');
        if (this.decoders[team] !== id) fail('DECODER_ONLY', '由本隊猜碼代表確認四個詞', 403);
        if (this.tieGuesses[team]) fail('ALREADY_SUBMITTED', '答案已鎖定');
        if (!Array.isArray(data.words) || data.words.length !== 4)
          fail('INVALID_WORDS', '請填四個詞，可留空', 400);
        this.tieGuesses[team] = data.words.map((s) => text(s, 40));
        if (this.tieGuesses[0] && this.tieGuesses[1]) {
          const hits = [0, 1].map(
            (t) =>
              new Set(
                this.tieGuesses[t]
                  .map(normalize)
                  .filter((w) => this.keywords[1 - t].some((k) => normalize(k) === w)),
              ).size,
          );
          this.end(hits[0] === hits[1] ? [0, 1] : [hits[0] > hits[1] ? 0 : 1], '猜關鍵詞', hits);
        } else this.event('keywords', TEAM_NAMES[team] + '已鎖定關鍵詞猜測。');
      } else fail('INVALID_ACTION', '不支援的操作', 400);
    });
  }
  reveal() {
    const right = (guess) => JSON.stringify(guess) === JSON.stringify(this.codes[this.turn]);
    const decoded = right(this.guesses.decode),
      intercepted = this.round > 1 && right(this.guesses.intercept);
    if (!decoded) this.teams[this.turn].failures++;
    if (intercepted) this.teams[1 - this.turn].interceptions++;
    this.results.push({
      round: this.round,
      team: this.turn,
      encryptor: this.encryptors[this.turn],
      clues: this.clues[this.turn].slice(),
      code: this.codes[this.turn].slice(),
      decode: this.guesses.decode.slice(),
      intercept: this.guesses.intercept?.slice() ?? null,
      decoded,
      intercepted,
    });
    this.phase = 'reveal';
    this.event(
      'reveal',
      TEAM_NAMES[this.turn] +
        '答案揭曉；' +
        (decoded ? '隊內猜中' : '溝通失誤') +
        (intercepted ? '，對方截碼成功。' : '。'),
    );
  }
  resolveRound() {
    const winning = this.teams.map(
      (t, i) => t.interceptions >= 2 || this.teams[1 - i].failures >= 2,
    );
    if (!winning.some(Boolean) && this.round < 8) return false;
    if (winning[0] !== winning[1]) this.end([winning[0] ? 0 : 1], '截碼／失誤');
    else {
      const scores = this.teams.map((t) => t.interceptions - t.failures);
      if (scores[0] !== scores[1]) this.end([scores[0] > scores[1] ? 0 : 1], '淨分');
      else {
        this.phase = 'tiebreak';
        this.event('tiebreak', '淨分相同：兩隊秘密猜對方四個關鍵詞，不計順序。');
      }
    }
    return true;
  }
  end(teams, reason, keywordHits = null) {
    this.phase = 'finished';
    this.winner = { teams, names: teams.map((t) => TEAM_NAMES[t]), reason, keywordHits };
    this.players.forEach(
      (p) =>
        (p.score =
          this.teams[this.teamOf(p.id)]?.interceptions - this.teams[this.teamOf(p.id)]?.failures),
    );
    this.event(
      'finish',
      teams.map((t) => TEAM_NAMES[t]).join('、') + (teams.length === 2 ? '共同獲勝。' : '獲勝。'),
    );
  }
  view(id) {
    const base = this.baseView(id),
      team = this.teamOf(id),
      finished = this.phase === 'finished' && !this.interrupted;
    const history = [0, 1].map((t) =>
      [1, 2, 3, 4].map((n) =>
        this.results
          .filter((r) => r.team === t)
          .flatMap((r) => r.code.flatMap((digit, i) => (digit === n ? [r.clues[i]] : []))),
      ),
    );
    return clone({
      ...base,
      teams: this.teams.map((t, i) => ({ ...t, name: TEAM_NAMES[i] })),
      myTeam: team,
      keywords: finished ? this.keywords : this.keywords.map((w, i) => (i === team ? w : [])),
      secretCode: this.phase === 'clues' && this.encryptors[team] === id ? this.codes[team] : null,
      clues:
        this.phase === 'clues'
          ? this.clues.map((c, i) => (i === team && this.encryptors[team] === id ? c : null))
          : this.clues.map((c, i) => (i <= this.turn || finished ? c : null)),
      clueReady: this.clues.map(Boolean),
      encryptors: this.encryptors,
      decoders: this.decoders,
      turn: this.turn,
      history,
      guessReady: { decode: !!this.guesses.decode, intercept: !!this.guesses.intercept },
      myGuess:
        this.phase === 'guessing'
          ? ((team === this.turn ? this.guesses.decode : this.guesses.intercept) ?? null)
          : null,
      tieReady: [!!this.tieGuesses[0], !!this.tieGuesses[1]],
      tieGuesses: finished ? this.tieGuesses : {},
      maxPlayers: 8,
    });
  }
}
module.exports = { DecryptoRoom, CODES, TEAM_NAMES };
