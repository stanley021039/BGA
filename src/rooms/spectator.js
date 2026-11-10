'use strict';
const { createHash } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { SCENES, ROLES, APPROACHES } = require('../games/trpg');
const { allRacers, tracks } = require('../games/second-wind/catalog');
const { NAMES } = require('../games/quacks-catalog');

const games = Object.freeze({
  poker: '德州撲克',
  thunder: '雷霆之路',
  majority: '同頻俱樂部',
  gift: '送禮達人',
  draw: '你畫我猜',
  trpg: '霧港跑團',
  telephone: '傳情畫意',
  musicquiz: '猜歌挑戰',
  minimal: '極簡畫家',
  bluff: '瞎掰王',
  decrypto: '截碼戰',
  quacks: '郎中闖江湖',
  ceo: '王牌執行長',
  'second-wind': '運動員',
  lounge: '場外休憩區',
});
const phases = {
  waiting: '等待開局',
  finished: '本局結束',
  showdown: '攤牌結算',
  preflop: '翻牌前',
  flop: '翻牌',
  turn: '轉牌',
  river: '河牌',
  choosing: '選擇中',
  answering: '作答中',
  review: '整理答案',
  reveal: '本輪揭曉',
  selecting: '選題中',
  preparing: '準備中',
  discussion: '討論中',
  drawing: '作畫中',
  guessing: '猜題中',
  prompting: '想主題',
  passing: '傳遞中',
  planning: '規劃行動',
  delivering: '送禮揭曉',
  pick: 'DJ準備',
  intro: '前奏挑戰',
  timeline: '放置年代卡',
  challenge: '插歌中',
  patients: '選擇病患',
  'round-intro': '本輪準備',
  brewing: '熬製中',
  settlement: '結算與採購',
  between: '輪間準備',
  playing: '遊戲進行中',
  drafting: '選秀中',
  racing: '競速中',
  'race-ready': '選角完成',
  assign: '分配骰子',
  move: '移動車輛',
  shoot: '射擊',
  airshoot: '空中射擊',
  'draft-rolloff': '決定選秀先手',
  'race-rolloff': '決定競速先手',
  'race-result': '本場賽果',
  fortune: '翻開占卜卡',
  bonus: '公路加速',
  effects: '處理車輛事件',
  airplace: '直升機部署',
};
const rows = (value) => (Array.isArray(value) ? value : []);
const str = (value) => (typeof value === 'string' ? value : '');
const num = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);
const fields = (value, keys) =>
  Object.fromEntries(
    keys.filter((key) => value?.[key] !== undefined).map((key) => [key, value[key]]),
  );
const strokes = (value) =>
  rows(value).map((s) =>
    fields(s, [
      'tool',
      'color',
      'size',
      'filled',
      'points',
      'strokeId',
      'version',
      'pointTimes',
      'curve',
    ]),
  );
const shapes = (value) =>
  rows(value).map((s) => fields(s, ['kind', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r']));
const song = (s) =>
  [str(s?.title), str(s?.artist), s?.year ? String(s.year) : ''].filter(Boolean).join(' · ');

// Audio identity is available to ordinary players too. Only the active clip may
// be requested; GameAudioLibrary validates round/stage and never serves originals.
function observerAudioContext(room) {
  if (
    room.type === 'musicquiz' &&
    room.current &&
    ['intro', 'timeline', 'challenge', 'reveal', 'finished'].includes(room.phase)
  ) {
    const intro = room.phase === 'intro';
    return {
      playback: {
        provider: 'youtube',
        videoId: room.current.videoId,
        start: intro ? room.current.introStart : room.current.highlightStart,
        seconds: intro ? 8 : 30,
        stage: intro ? 'intro' : 'highlight',
        clipReviewed: room.current.clipReviewed === true,
      },
    };
  }
  if (
    room.type === 'majority' &&
    room.options.mode === 'music' &&
    ['answering', 'reveal'].includes(room.phase)
  )
    return {
      question: {
        entries: rows(room.question?.entries).map((entry) =>
          fields(entry, ['id', 'label', 'videoId', 'start', 'seconds']),
        ),
      },
    };
  return {};
}

function observerPlayerId(room, id) {
  return (
    'observer-' +
    createHash('sha256')
      .update(room.code + ':' + id)
      .digest('hex')
      .slice(0, 24)
  );
}

function publicGame(game, ids) {
  const alias = (value) => {
    if (Array.isArray(value)) return value.map(alias);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [ids.get(key) ?? key, alias(item)]),
      );
    return typeof value === 'string' ? (ids.get(value) ?? value) : value;
  };
  return alias({ ...game, events: [] });
}

function spectatorView(room, gameAudio) {
  const type = room.type || 'poker';
  if (!Object.hasOwn(games, type))
    throw new HttpError(404, 'WATCH_UNAVAILABLE', '這款遊戲尚未開放觀戰');
  const now = room.now?.() ?? Date.now(),
    active = rows(room.players).filter((p) => !p.kicked);
  const names = new Map(rows(room.players).map((p) => [p.id, p.name]));
  const name = (id) => names.get(id) || '離席玩家';
  const ids = new Map(rows(room.players).map((p) => [p.id, observerPlayerId(room, p.id)]));
  const done = ['finished', 'showdown'].includes(room.phase);
  const out = {
    schema: 1,
    spectator: true,
    code: room.code,
    name: room.name,
    type,
    title: games[type],
    phase: room.phase,
    phaseLabel: phases[room.phase] || '遊戲進行中',
    version: num(room.version, num(room.updated)),
    gameRevision: num(room.gameRevision),
    serverNow: now,
    round: num(room.round, num(room.hand)),
    roundLimit: num(room.roundLimit),
    deadline:
      room.phase !== 'waiting' && !done && Number.isFinite(room.deadline) ? room.deadline : null,
    duration: 90000,
    players: [],
    sections: [],
    cards: [],
    drawing: null,
    drawings: [],
    books: [],
    track: null,
    pots: [],
    clips: [],
    images: [],
  };
  const section = (title, lines = [], items = [], owner) =>
    out.sections.push({
      title,
      lines: lines.filter(Boolean),
      items,
      ...(owner ? { playerId: ids.get(owner) } : {}),
    });
  const item = (label, detail = '') => ({
    label: String(label ?? ''),
    detail: String(detail ?? ''),
  });
  const ready = new Set();
  let actor = null;
  out.players = active.map((p) => ({
    id: ids.get(p.id),
    name: p.name,
    avatar: p.avatar || null,
    host: p.id === room.host,
    bot: !!p.bot,
    online: !!p.bot || now - num(p.lastSeen) < 15000,
    score: Number.isFinite(p.score) ? p.score : null,
    status: room.phase === 'waiting' ? '等待開始' : done ? '已結束' : '遊戲中',
    lines: [],
    cards: [],
  }));
  const player = (id) => out.players.find((p) => p.id === ids.get(id));
  const mark = (values) => rows(values).forEach((id) => ready.add(id));

  switch (type) {
    case 'decrypto': {
      out.decryptoScene = publicGame(
        {
          ...fields(room, [
            'round',
            'roundId',
            'roundLimit',
            'encryptors',
            'decoders',
            'turn',
            'results',
            'interrupted',
            'winner',
          ]),
          teams: room.teams.map((team, index) => ({
            ...fields(team, ['members', 'interceptions', 'failures']),
            name: index === 0 ? '白隊' : '黑隊',
          })),
          keywords: done && !room.interrupted ? room.keywords : [[], []],
          clues: room.clues.map((clues, team) =>
            room.phase !== 'clues' && (team <= room.turn || done) ? clues : null,
          ),
          clueReady: room.clues.map(Boolean),
          history: [0, 1].map((team) =>
            [1, 2, 3, 4].map((digit) =>
              room.results
                .filter((result) => result.team === team)
                .flatMap((result) =>
                  result.code.flatMap((value, index) =>
                    value === digit ? [result.clues[index]] : [],
                  ),
                ),
            ),
          ),
          guessReady: { decode: !!room.guesses.decode, intercept: !!room.guesses.intercept },
          tieReady: [!!room.tieGuesses[0], !!room.tieGuesses[1]],
          tieGuesses: done && !room.interrupted ? room.tieGuesses : {},
        },
        ids,
      );
      for (const [t, team] of room.teams.entries()) {
        section(team.name || (t === 0 ? '白隊' : '黑隊'), [
          `截碼成功 ${team.interceptions}／2 · 溝通失誤 ${team.failures}／2`,
        ]);
      }
      if (room.phase !== 'clues')
        for (const [t, clues] of room.clues.entries())
          if (t <= room.turn && clues) section((t === 0 ? '白隊' : '黑隊') + '公開線索', clues);
      for (const r of room.results)
        section(`第 ${r.round} 輪 ${r.team === 0 ? '白隊' : '黑隊'}揭曉`, [
          r.clues.join('／'),
          `正確密碼 ${r.code.join('－')} · ${r.decoded ? '隊內猜中' : '溝通失誤'} · ${r.intercepted ? '被截碼' : '未被截碼'}`,
        ]);
      if (done && !room.interrupted) {
        section('本場結果', [(room.winner?.names || []).join('、')]);
        for (const [t, words] of room.keywords.entries())
          section((t === 0 ? '白隊' : '黑隊') + '關鍵詞', words);
      }
      break;
    }
    case 'poker': {
      out.duration = 45000;
      out.cards = rows(room.board).slice(0, 5);
      actor = room.players[room.turn]?.id;
      section('牌桌', [
        `底池 ${active.reduce((sum, p) => sum + num(p.total), 0)}`,
        `目前下注 ${num(room.currentBet)}`,
      ]);
      for (const p of active) {
        const row = player(p.id),
          revealed =
            room.phase === 'showdown' && !p.folded && active.filter((q) => !q.folded).length > 1;
        row.lines = [
          `籌碼 ${p.stack}`,
          `下注 ${p.bet}`,
          p.folded ? '已棄牌' : str(p.action),
        ].filter(Boolean);
        row.cards = rows(p.cards).map((card) => (revealed ? card : null));
      }
      if (done)
        section(
          '本局結算',
          [],
          rows(room.results).map((r) => item(r.name, `${r.amount} · ${r.hand}`)),
        );
      out.pokerTable = {
        hand: num(room.hand),
        button: active.indexOf(room.players[room.button]),
        turn: active.indexOf(room.players[room.turn]),
        currentBet: num(room.currentBet),
        minRaise: num(room.minRaise, 20),
        pot: room.players.reduce((sum, p) => sum + num(p.total), 0),
        players: active.map((p) => ({
          id: ids.get(p.id),
          stack: p.stack,
          bet: p.bet,
          total: p.total,
          folded: !!p.folded,
          action: str(p.action),
        })),
        results: done ? rows(room.results).map((r) => fields(r, ['name', 'amount', 'hand'])) : [],
      };
      break;
    }
    case 'draw': {
      actor = room.presenterId;
      mark(room.guessedIds);
      out.duration =
        room.phase === 'choosing'
          ? 15000
          : room.phase === 'reveal'
            ? 8000
            : num(room.options?.seconds, 90) * 1000;
      const revealed =
        ['reveal', 'finished'].includes(room.phase) &&
        room.result?.canvasEpoch === room.canvas.epoch;
      out.drawScene = publicGame({
        ...fields(room, ['round', 'roundLimit', 'presenterId', 'options', 'deadline',
          'participantIds', 'guessedIds', 'winner', 'matchSummary']),
        canvasEpoch: room.canvas.epoch,
        strokeVersion: room.canvas.version,
        question: revealed && room.question ? fields(room.question, ['title', 'category', 'topicLabel']) : null,
        result: revealed && room.result?.resultId ? room.result : null,
        guesses: rows(room.guesses).filter((guess) => guess.id && Number.isFinite(guess.at)).map((guess) => ({
          ...fields(guess, ['id', 'name', 'correct', 'points', 'at']),
          ...(!guess.correct ? { answer: guess.answer } : {}),
        })),
        ...(room.options.playMode === 'oracle' ? { oracle: room.oracle.view(room, null) } : {}),
      }, ids);
      section('本輪題目', [
        revealed ? room.question?.title : '答案尚未揭曉',
        !revealed && room.question
          ? `${str(room.question.category)} · ${[...room.question.title].length} 字`
          : '',
      ]);
      out.drawing = { epoch: room.canvas.epoch, strokes: strokes(room.canvas.strokes) };
      section(
        '公開猜題',
        [],
        rows(room.guesses).map((g) =>
          item(g.name, g.correct ? `答對 · ${num(g.points)} 分` : g.text),
        ),
      );
      if (revealed) section('本輪答案', [room.result?.title || room.question?.title]);
      break;
    }
    case 'telephone': {
      const v = room.observerView();
      out.telephoneScene = fields(v, [
        'round',
        'roundLimit',
        'stepId',
        'deadline',
        'interrupted',
        'options',
        'sources',
        'books',
        'review',
      ]);
      out.duration =
        (room.phase === 'passing' && room.round % 2
          ? v.options.drawingSeconds
          : v.options.textSeconds) * 1000;
      mark(active.filter((p) => room.submissions[p.id]).map((p) => p.id));
      section('階段時間', [
        `作畫 ${v.options.drawingSeconds} 秒`,
        `文字／猜題 ${v.options.textSeconds} 秒`,
        '傳遞中的題目、畫作與私人草稿在全局結束後才揭曉。',
      ]);
      out.books = rows(v.books).map((book) => ({
        ownerId: book.ownerId,
        ownerName: book.ownerName,
        pages: rows(book.pages).map((page) => ({
          kind: page.kind,
          authorName: page.authorName,
          text: str(page.text),
          skipped: !!page.skipped,
          timedOut: !!page.timedOut,
          strokes: strokes(page.strokes),
        })),
      }));
      break;
    }
    case 'majority': {
      out.duration = 120000;
      actor = room.presenterId;
      mark(Object.keys(room.answers || {}));
      const visible = ['review', 'reveal', 'finished'].includes(room.phase),
        q = room.question;
      out.majorityScene = publicGame(
        {
          ...fields(room, [
            'presenterId',
            'round',
            'roundLimit',
            'options',
            'deadline',
            'participantIds',
            'winner',
          ]),
          question: q ? {
            ...fields(q, ['id', 'type', 'topic', 'prompt', 'options', 'images', 'pack', 'shared', 'reused']),
            ...(q.entries ? { entries: q.entries.map((entry) =>
              fields(entry, ['id', 'label', 'detail', 'bank', 'image']),
            ) } : {}),
          } : null,
          tournament: room.tournamentView(),
          cruel: room.cruelView(null),
          answeredIds: Object.keys(room.answers),
          groups: visible ? room.groups : [],
          answers: visible ? room.answers : {},
          result: ['reveal', 'finished'].includes(room.phase) ? room.result : null,
          departed: rows(room.players)
            .filter((p) => p.kicked)
            .map((p) => fields(p, ['id', 'name'])),
          reactions: rows(room.reactions).filter((r) => now - r.at < 8000),
        },
        ids,
      );
      section(
        '本輪問題',
        [
          typeof q === 'string'
            ? q
            : str(q?.prompt) ||
              str(q?.title) ||
              str(q?.text) ||
              (q?.entries ? '二選一投票' : '等待選題'),
        ],
        [
          ...rows(q?.options).map((option) => item(option)),
          ...rows(q?.entries).map((entry) => item(entry.label || entry.title)),
        ],
      );
      out.images = rows(q?.images).flatMap((src, i) =>
        typeof src === 'string' && /^\/assets\/[a-z0-9/_-]+\.(?:svg|webp|png|jpe?g)$/i.test(src)
          ? [{ src, alt: str(q.options?.[i]) || `選項 ${i + 1}` }]
          : [],
      );
      if (visible)
        section(
          '答案分組',
          [],
          rows(room.groups).map((group) =>
            item(
              group.answer || group.label || group.key,
              `${num(group.count)} 人 · ${rows(group.playerIds).map(name).join('、')}`,
            ),
          ),
        );
      else section('作答進度', [`${ready.size} 人已送出；個別答案尚未公開。`]);
      const t = room.tournamentView?.();
      if (t)
        section('淘汰賽', [
          `${t.stage} 強 · 第 ${t.pair} 組`,
          t.champion ? `冠軍：${t.champion.label}` : '',
        ]);
      break;
    }
    case 'gift': {
      actor = room.dealerId;
      const choosing = room.phase === 'choosing';
      const delivery = room.phase === 'delivering' ? room.delivery : null;
      const recipient = delivery?.order[delivery.index];
      out.giftScene = publicGame(
        {
          ...fields(room, ['round', 'target', 'customPercent', 'dealerId', 'winner']),
          includeAdult: !!room.includeAdult,
          gifts: rows(room.gifts).map((gift) => fields(gift, ['id', 'title', 'category', 'image'])),
          players: active.map((p) => fields(p, ['id', 'giveScore', 'getScore'])),
          gaveIds: choosing ? Object.keys(room.assignments) : [],
          wishedIds: choosing ? Object.keys(room.rankings) : [],
          submittedIds: choosing
            ? active.filter((p) => room.assignments[p.id] && room.rankings[p.id]).map((p) => p.id)
            : [],
          delivery: delivery
            ? {
                recipientId: recipient,
                index: delivery.index,
                total: delivery.order.length,
                entries: rows(room.pendingResult?.entries)
                  .filter(
                    (entry) =>
                      entry.recipientId === recipient && active.some((p) => p.id === entry.giverId),
                  )
                  .map((entry) =>
                    fields(entry, ['giverId', 'recipientId', 'giftId', 'rank', 'points']),
                  ),
              }
            : null,
          result: ['reveal', 'finished'].includes(room.phase) ? room.result : null,
        },
        ids,
      );
      mark(
        active.filter((p) => room.assignments?.[p.id] && room.rankings?.[p.id]).map((p) => p.id),
      );
      section(
        '本輪禮物',
        [],
        rows(room.gifts).map((g) => item(g.title || g.name, g.description || g.text)),
      );
      for (const p of active)
        player(p.id).lines = [`送禮 ${num(p.giveScore)} 分`, `收禮 ${num(p.getScore)} 分`];
      if (room.phase === 'delivering' && room.delivery) {
        section(
          `正在送給 ${name(recipient)}`,
          [],
          rows(room.pendingResult?.entries)
            .filter(
              (entry) =>
                entry.recipientId === recipient && active.some((p) => p.id === entry.giverId),
            )
            .map((entry) =>
              item(
                `${name(entry.giverId)} → ${name(entry.recipientId)}`,
                `${room.gifts.find((g) => g.id === entry.giftId)?.title || entry.giftId} · ${entry.points} 分`,
              ),
            ),
        );
      }
      if (['reveal', 'finished'].includes(room.phase))
        section(
          '送禮結果',
          [],
          rows(room.result?.entries).map((entry) =>
            item(
              `${name(entry.giverId)} → ${name(entry.recipientId)}`,
              `${room.gifts.find((g) => g.id === entry.giftId)?.title || entry.giftId} · ${entry.points} 分`,
            ),
          ),
        );
      break;
    }
    case 'minimal': {
      out.duration = 10000;
      actor = room.guesserId;
      mark(Object.keys(room.ready || {}));
      const revealed = ['reveal', 'finished'].includes(room.phase);
      section('題目', [revealed ? room.question?.title : '答案尚未揭曉；只顯示目前展示的畫作。']);
      const artist = room.phase === 'guessing' ? room.order[room.shown] : null;
      out.minimalScene = publicGame(
        {
          round: room.round,
          roundLimit: room.roundLimit,
          roundId: room.roundId,
          guesserId: room.guesserId,
          deadline: room.deadline,
          readyIds: Object.keys(room.ready),
          currentDrawing: artist
            ? {
                name: name(artist),
                count: room.drafts[artist].length,
                shapes: room.drafts[artist],
              }
            : null,
          order:
            room.phase === 'guessing'
              ? room.order.map((id) => ({
                  name: name(id),
                  count: room.drafts[id].length,
                }))
              : [],
          attempts: room.phase === 'drawing' ? [] : room.attempts,
          results: room.results,
          interrupted: room.interrupted,
          winner: room.winner,
        },
        ids,
      );
      if (artist) out.drawings.push({ title: name(artist), shapes: shapes(room.drafts[artist]) });
      if (revealed)
        out.drawings = rows(room.results.at(-1)?.drawings).map((d) => ({
          title: d.name,
          shapes: shapes(d.shapes),
        }));
      if (room.phase !== 'drawing')
        section(
          '猜題紀錄',
          [],
          rows(room.attempts).map((a) =>
            item(a.artistName, `${a.text} · ${a.correct ? '答對' : '未答對'}`),
          ),
        );
      break;
    }
    case 'bluff': {
      out.bluffScene = publicGame(room.observerView(), ids);
      out.duration = num(room.options.roleSeconds, 10) * 1000;
      actor = room.thinkerId;
      mark(room.readyIds);
      if (['preparing', 'discussion'].includes(room.phase))
        section('本輪題目', [room.question?.title, '老實人身分、答案與私人筆記尚未揭曉。']);
      if (room.phase === 'discussion')
        section(
          '公開發言',
          [],
          [
            ...rows(room.transcript).map((e) => item(e.name, e.text)),
            ...Object.entries(room.botStatements || {}).map(([id, text]) => item(name(id), text)),
            ...Object.entries(room.answers || {}).map(([id, text]) => item(name(id), text)),
          ],
        );
      if (['reveal', 'finished'].includes(room.phase)) {
        const result = room.results.at(-1);
        if (result)
          section(
            '本輪揭曉',
            [
              result.title,
              `答案：${result.answer}`,
              ...(typeof result.explanation === 'string'
                ? [result.explanation]
                : ['detail', 'example', 'clarification'].map((key) =>
                    str(result.explanation?.[key]),
                  )),
              `老實人：${result.honestName}`,
            ],
            rows(result.roles).map((r) =>
              item(r.name, `${r.role === 'honest' ? '老實人' : '瞎掰者'} · ${r.delta} 分`),
            ),
          );
      }
      break;
    }
    case 'musicquiz': {
      out.musicScene = publicGame(room.observerView(), ids);
      actor = room.players.length ? room.dj().id : null;
      out.musicTimelines = active.map((p) => ({
        playerId: ids.get(p.id),
        cards: rows(p.timeline).map((entry) =>
          fields(entry, ['title', 'year', 'artist', 'language']),
        ),
      }));
      mark(Object.keys(room.answers || {}));
      out.duration = room.phase === 'intro' ? 30000 : room.phase === 'timeline' ? 60000 : 15000;
      const visible = ['reveal', 'finished'].includes(room.phase);
      section(
        '本輪歌曲',
        [visible ? song(room.current) : '歌名與年份尚未揭曉'],
        room.phase === 'intro' ? rows(room.introChoices).map((choice) => item(choice.title)) : [],
      );
      for (const p of active) {
        player(p.id).lines = [`標記 ${num(p.tokens, 2)} · 獎勵 ${num(p.bonus)}`];
        section(
          `${p.name} 的年代軸`,
          [],
          rows(p.timeline).map((card) => item(song(card))),
          p.id,
        );
      }
      if (['challenge', 'reveal', 'finished'].includes(room.phase))
        section(
          '插槽',
          [`DJ放在第 ${num(room.placement) + 1} 槽`],
          Object.entries(room.challenges || {}).map(([id, slot]) =>
            item(name(id), `第 ${num(slot) + 1} 槽`),
          ),
        );
      break;
    }
    case 'trpg': {
      actor = room.leaderId;
      mark(Object.keys(room.plans || {}));
      const scene = SCENES[room.round - 1];
      out.trpgScene = publicGame(
        {
          round: room.round,
          roundLimit: 6,
          sceneId: room.sceneId,
          leaderId: room.leaderId,
          narratorMode: 'rules',
          adventure: '霧港鐘聲',
          supplies: room.supplies,
          clues: room.clues,
          danger: room.danger,
          roles: ROLES,
          scene: scene ? fields(scene, ['title', 'text', 'zone']) : null,
          approaches: scene
            ? Object.entries(APPROACHES).map(([id, approach], index) => ({
                id,
                ...approach,
                description: scene.choices[index],
              }))
            : [],
          players: active.map((p) => ({
            id: p.id,
            role: p.role,
            roleName: ROLES[p.role].name,
            focus: p.focus,
            ready: !!room.plans[p.id],
            offline: !p.bot && now - num(p.lastSeen) >= 15000,
          })),
          readyCount: active.filter((p) => room.plans[p.id]).length,
          myPlan: null,
          canResolve: false,
          results: room.results,
          winner: room.winner,
        },
        ids,
      );
      section(scene?.title || '霧港鐘聲', [
        scene?.text,
        `補給 ${num(room.supplies)} · 線索 ${num(room.clues)} · 危險 ${num(room.danger)}`,
      ]);
      for (const p of active)
        player(p.id).lines = [ROLES[p.role]?.name || '', `專注 ${num(p.focus)}`];
      section(
        '已揭曉的冒險',
        [],
        rows(room.results).map((r) => item(r.title, `${r.text} · ${r.total}／${r.difficulty}`)),
      );
      if (done && room.winner) section(room.winner.title, [room.winner.text]);
      break;
    }
    case 'quacks': {
      out.quacksScene = publicGame(room.observerView(), ids);
      if (room.phase === 'round-intro' && Number.isFinite(room.nextRoundAt)) {
        out.deadline = room.nextRoundAt;
        out.duration = Math.max(1000, room.nextRoundAt - num(room.fortuneDrawnAt, now));
      }
      const revealed = ['settlement', 'between', 'finished'].includes(room.phase);
      const fortune = room.fortune;
      const stages = {
        card: '翻開占卜卡',
        prepare: '熬製準備',
        drawing: '抽取藥材',
        witches: '女巫效果',
        bonus: '獎勵骰',
        'effects-confirm': '確認藥材效果',
        rewards: '選擇獎勵',
        shopping: '採購藥材',
      };
      section('本輪狀態', [
        stages[room.stage] || '',
        fortune?.title || fortune?.name,
        fortune?.text || fortune?.description,
      ]);
      mark(
        active
          .filter((p) => p.ready || p.stopped || Object.hasOwn(room.intents || {}, p.id))
          .map((p) => p.id),
      );
      out.pots = active.map((p) => {
        const visible = !room.options.hiddenProgress || p.exploded || revealed;
        player(p.id).lines = [
          `紅寶石 ${num(p.rubies)} · 袋中 ${rows(p.bag).length} 枚`,
          p.exploded ? '爆鍋' : p.stopped ? '已停手' : '',
        ];
        return {
          name: p.potName || `${p.name}的鍋`,
          playerId: ids.get(p.id),
          hidden: !visible,
          position: visible ? num(p.position) : null,
          chips: visible
            ? rows(p.pot).map((chip) => ({
                ...fields(chip, ['color', 'value', 'position']),
                label: NAMES[chip.color] || str(chip.color),
                effect:
                  chip.color === 'white'
                    ? '依數值前進；白色總數值超過爆炸門檻時爆炸。'
                    : Object.hasOwn(NAMES, chip.color)
                      ? str(room.bookFor(chip.color)?.effect)
                      : '',
              }))
            : [],
        };
      });
      if (room.phase === 'patients') section('病患選擇', ['等待玩家完成私人選擇。']);
      if (room.phase === 'settlement' && room.stage === 'shopping') {
        actor = room.marketTurn();
        section(
          '藥材市場剩餘數量',
          [],
          Object.entries(room.marketSupply || {}).map(([key, count]) => {
            const [color, value] = key.split(':');
            return item(`${NAMES[color] || color} ${value}`, String(count));
          }),
        );
        section(
          '公開採購紀錄',
          [],
          rows(room.purchaseNotices)
            .slice(-16)
            .map((notice) =>
              item(notice.name, `${NAMES[notice.color] || notice.color} ${notice.value}`),
            ),
        );
      }
      break;
    }
    case 'thunder': {
      out.raceDevilsRun = room.options?.devilsRun === true;
      const masked = room.diceCheck?.kind === 'round';
      actor = room.actor();
      if (masked) actor = null;
      section('公路賽況', [
        room.pending ? '等待事件結算' : '',
        masked ? '擲骰確認中，結果尚未公開' : '',
      ]);
      const cells = rows(room.tiles).flatMap((tile) =>
        rows(tile.cells).flatMap((row, x) =>
          rows(row).map((cell, j) => ({
            row: x,
            column: tile.start + j,
            label: cell.hazard ? (cell.hazard.face ? cell.hazard.kind : '?') : cell.kind,
            names: rows(room.cars)
              .filter((car) => !car.dead && car.x === x && car.y === tile.start + j)
              .map((car) => `${name(car.owner)} ${car.size || ''}`),
          })),
        ),
      );
      out.track = { title: '雷霆之路', cells };
      if (cells.length) {
        out.raceBoard = {
          finishAt: room.finishAt ?? null,
          activeCar: masked ? null : (room.active?.car ?? null),
          actorId: ids.get(actor) ?? null,
          roadDie: masked ? null : (room.roadDie ?? null),
          activeRemaining: masked ? 0 : num(room.active?.remaining),
          diceTitle: room.diceCheck?.title || '',
          tiles: rows(room.tiles).map(({ start, name, map, side, cells }) => ({
            start,
            name,
            map,
            side,
            cells: cells.map((row) =>
              row.map(({ kind, hazard }) => ({
                kind,
                ...(hazard
                  ? { hazard: { face: !!hazard.face, kind: hazard.face ? hazard.kind : 'unknown' } }
                  : {}),
              })),
            ),
          })),
          cars: rows(room.cars).map(
            ({ id, owner, size, x, y, damage, dead, wreck, burning, moved }) => ({
              id,
              owner: ids.get(owner) ?? null,
              size,
              x,
              y,
              damage: rows(damage).map(() => true),
              dead,
              wreck,
              burning,
              moved,
            }),
          ),
          players: active.map(({ id, name, color, chopper, dice, commandUsed }) => ({
            id: ids.get(id),
            name,
            color,
            chopper: chopper ? { x: chopper.x, y: chopper.y } : null,
            dice: masked ? [] : rows(dice).map(({ value, used }) => ({ value, used: !!used })),
            commandUsed: !!commandUsed,
          })),
          winner:
            room.winner && typeof room.winner === 'object'
              ? {
                  id: ids.get(room.winner.id) ?? null,
                  name: room.winner.name,
                  reason: room.winner.reason,
                }
              : null,
        };
      }
      for (const p of active)
        player(p.id).lines =
          room.phase === 'waiting'
            ? []
            : masked
              ? ['骰子尚未公開']
              : [
                  `骰子：${rows(p.dice)
                    .map((d) => d.value ?? d.n ?? '?')
                    .join('、')}`,
                ];
      if (room.winner)
        section('終點', [typeof room.winner === 'string' ? name(room.winner) : room.winner.name]);
      break;
    }
    case 'ceo': {
      const g = room.observerGame();
      out.nativeGame = g ? publicGame(g, ids) : null;
      section('牌庫', ['本站暫用替代牌庫；公司內容與原版不同。']);
      if (g) {
        actor = g.turnId;
        section(
          '公開市場',
          [],
          rows(g.market).map((entry) =>
            item(
              entry.card?.name || entry.card?.title || entry.card?.id,
              `額外費用 ${entry.extraCost}`,
            ),
          ),
        );
        for (const p of rows(g.players))
          if (player(p.id))
            player(p.id).lines = [
              `現金 ${num(p.cash)}`,
              ...rows(p.holdings)
                .filter((h) => h.count > 0)
                .map(
                  (h) =>
                    `${g.groups.find((group) => group.id === h.groupId)?.card?.name || h.groupId} ${h.count} 股`,
                ),
            ];
        section(
          '公司集團',
          [],
          rows(g.groups).map((group) =>
            item(
              `${group.card?.name || group.card?.title || group.id} · ${group.playerId ? name(group.playerId) : '尚未收購'}`,
              `公開資產 ${group.publicAssets} · 收入 ${group.income} · 調整 ${group.adjustmentCount} 次${group.nextStockPrice !== null ? ' · 下張股票 ' + group.nextStockPrice : ''}；公司：${
                rows(group.companies)
                  .map((c) => c.name || c.title || c.id)
                  .join('、') || '尚無'
              }${g.phase === 'finished' ? '；調整揭曉：' + rows(group.adjustments).join('、') : ''}`,
            ),
          ),
        );
        if (g.phase === 'finished')
          section(
            '資產結算',
            [],
            rows(g.results?.players).map((p) => item(name(p.playerId), `總資產 ${p.total}`)),
          );
      }
      break;
    }
    case 'second-wind': {
      const g = room.observerGame();
      out.nativeGame = g ? publicGame(g, ids) : null;
      out.nativeGameOptions = fields(room.options, ['racerSet']);
      const racer = (id) => allRacers.find((r) => r.id === id)?.name || str(id);
      if (g) {
        actor = g.turnId;
        mark(g.selectedIds);
        out.phaseLabel = phases[g.phase] || g.phase;
        for (const p of active)
          player(p.id).lines = [
            `積分 ${num(g.scores?.[p.id], num(p.score))}`,
            `隊伍：${rows(g.teams?.[p.id]).map(racer).join('、') || '等待招募'}`,
          ];
        if (g.stage === 'recruiting')
          section(
            '公開選秀市場',
            [g.phase === 'choosing' ? '秘密選角尚未公開。' : '依選秀順序挑選角色。'],
            rows(g.market).map((id) => item(racer(id))),
          );
        if (g.trackId) {
          const track = tracks[g.trackId];
          out.track = {
            title: track?.name || g.trackId,
            cells: Array.from({ length: (track?.finish || 30) + 1 }, (_, column) => ({
              row: 0,
              column,
              label: String(column),
              names: rows(g.racers)
                .filter((r) => Math.min(track?.finish || 30, Math.max(0, r.position)) === column)
                .map(
                  (r) =>
                    `${name(r.playerId)} · ${racer(r.racerId)}${r.eliminated ? '（退賽）' : r.finished ? '（完賽）' : ''}`,
                ),
            })),
          };
        }
        if (g.pending) section('能力選擇', [`等待 ${name(g.pending.playerId)} 完成選擇`]);
        if (g.rolls)
          section(
            '先手擲骰',
            [],
            Object.entries(g.rolls).map(([id, roll]) =>
              item(name(id), Array.isArray(roll) ? roll.join('、') : String(roll)),
            ),
          );
        if (g.twistCards?.length)
          section(
            '本場規則',
            [],
            g.twistCards.map((twist) => item(twist.id, twist.summary)),
          );
        section(
          '已公開賽果',
          [],
          rows(g.results).map((r) =>
            item(
              `第 ${r.race} 場`,
              rows(r.ranking)
                .map((p) => `${name(p.playerId)} ${p.rank || ''}`)
                .join('、'),
            ),
          ),
        );
      }
      break;
    }
    case 'lounge':
      out.phaseLabel = '休憩中';
      section('場外休憩區', ['唯讀查看在場名單；不加入房內聊天或媒體控制。']);
      break;
  }
  for (const p of active) {
    const row = player(p.id);
    if (!done && room.phase !== 'waiting')
      row.status = ready.has(p.id) ? '已完成本階段' : actor === p.id ? '目前操作中' : '進行中';
  }
  const audio = gameAudio
    ? gameAudio.decorate(room, observerAudioContext(room))
    : observerAudioContext(room);
  const playback = (p) => ({
    ...fields(p, ['provider', 'videoId', 'start', 'seconds', 'stage', 'clipReviewed']),
    ...(p.url ? { url: p.url.replace('/api/game-song-audio?', '/api/watch-audio?') } : {}),
  });
  if (audio.playback)
    out.clips.push({
      key: `${room.roundId}:${audio.playback.stage}`,
      label: '本輪歌曲片段',
      playback: playback(audio.playback),
    });
  for (const [i, entry] of rows(audio.question?.entries).entries()) {
    if (entry.audioUrl)
      out.clips.push({
        key: `${room.question.id}:${i}`,
        label: entry.label || `歌曲 ${i + 1}`,
        playback: {
          provider: 'audio',
          url: entry.audioUrl.replace('/api/game-song-audio?', '/api/watch-audio?'),
          seconds: entry.audioSeconds,
          start: 0,
          stage: 'highlight',
          clipReviewed: entry.clipReviewed,
        },
      });
    else if (entry.videoId)
      out.clips.push({
        key: `${room.question.id}:${i}`,
        label: entry.label || `歌曲 ${i + 1}`,
        playback: {
          provider: 'youtube',
          videoId: entry.videoId,
          start: num(entry.start),
          seconds: num(entry.seconds, 30),
          stage: 'highlight',
          clipReviewed: false,
        },
      });
  }
  // Detach all references: observers cannot mutate live room state in-process.
  return JSON.parse(JSON.stringify(out));
}
module.exports = { spectatorView, observerAudioContext, games };
