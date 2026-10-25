'use strict';

const { randomInt, randomUUID } = require('node:crypto');
const { SecondWindDraft } = require('./draft');
const { allRacers: catalog, racerSet, twists, tracks } = require('./catalog');
const base = require('./base-powers');
const { effectivePowers, mandatoryDieStep } = require('./powers');
const { fail } = require('../party-base');
const copy = (x) => structuredClone(x);
const awards = [
  [3, 1],
  [4, 2],
  [5, 3],
  [7, 4],
];
const alive = (r) => !r.finished && !r.eliminated;
const byId = Object.fromEntries(catalog.map((r) => [r.id, r]));
function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Server-owned resumable effect queue. Choices never run a second main move. */
class SecondWindGame {
  constructor({ playerIds, seed = null, racerSet: set = 'second-wind' }) {
    this.catalog = racerSet(set);
    this.racerSet = set;
    this.draft = new SecondWindDraft({ playerIds, seed, racerSet: set });
    this.state = null;
  }
  act(id, action, revision) {
    if (!this.state) {
      const view = this.draft.act(id, action, revision);
      if (view.phase === 'race-ready') {
        const owned = new Set(Object.values(view.teams).flat());
        this.state = {
          revision: view.revision,
          phase: 'choosing',
          players: view.players,
          teams: view.teams,
          scores: Object.fromEntries(view.players.map((p) => [p, 0])),
          race: 1,
          first: view.raceFirst,
          selections: Object.fromEntries(view.lineup.map((r) => [r.playerId, r.racerId])),
          reserve: shuffle(this.catalog.map((r) => r.id).filter((r) => !owned.has(r))),
          twistDeck: shuffle(twists.map((t) => t.id)),
          persistent: [],
          racers: [],
          events: [],
          eventId: 0,
          results: [],
          queue: [],
          pending: null,
        };
        this.beginRace();
        this.drain();
      }
      return this.view(id);
    }
    const s = this.state;
    if (!s.players.includes(id)) fail('NOT_SEATED', '尚未入座', 403);
    if (!Number.isSafeInteger(revision) || revision !== s.revision)
      fail('STALE_REVISION', '狀態已更新，請重讀後操作');
    if (!action || typeof action !== 'object') fail('INVALID_ACTION', '操作格式不正確', 400);
    const before = copy(s);
    try {
      if (action.type === 'select') {
        if (s.phase !== 'choosing' || s.selections[id]) fail('INVALID_PHASE', '目前不能選角');
        if (!s.teams[id].includes(action.racerId))
          fail('RACER_NOT_OWNED', '只能選自己的未出賽角色');
        s.selections[id] = action.racerId;
        if (s.players.every((p) => s.selections[p])) {
          this.beginRace();
          this.drain();
        }
      } else if (action.type === 'next-race') {
        if (s.phase !== 'race-result' || id !== s.first)
          fail('INVALID_PHASE', '等待下一場先手開始');
        s.race++;
        s.phase = 'choosing';
        s.selections = {};
        s.racers = [];
        s.pending = null;
      } else if (action.type === 'choice') {
        const p = s.pending;
        if (!p || p.playerId !== id || action.choiceId !== p.id)
          fail('NOT_YOUR_CHOICE', '目前不是你的選擇');
        if (!p.options.some((o) => o.value === action.value))
          fail('INVALID_CHOICE', '選項不正確', 400);
        s.pending = null;
        this.choose(p, action.value);
        this.drain();
      } else if (action.type === 'roll') {
        if (s.phase !== 'racing' || s.pending || s.turnId !== id || s.queue.length)
          fail('NOT_YOUR_TURN', '尚未輪到你行動');
        this.beginPlayerTurn();
        this.drain();
      } else fail('INVALID_ACTION', '不支援此操作', 400);
      s.revision++;
    } catch (error) {
      this.state = before;
      throw error;
    }
    return this.view(id);
  }
  emit(type, text, data = {}) {
    const s = this.state;
    const racer = data.racer ? this.racer(data.racer) : null;
    s.events.push({
      id: ++s.eventId,
      type,
      text,
      ...data,
      ...(racer ? { playerId: racer.playerId, racerId: racer.racerId } : {}),
    });
    s.events = s.events.slice(-100);
  }
  enqueue(...ops) {
    this.state.queue.unshift(
      ...ops
        .filter(Boolean)
        .map((op) =>
          this.baseCause?.length ? { ...op, baseCause: op.baseCause || [...this.baseCause] } : op,
        ),
    );
  }
  racer(id) {
    return this.state.racers.find((r) => r.id === id);
  }
  active() {
    return this.state.racers.filter(alive);
  }
  powers(r) {
    return effectivePowers(this.state.racers, r.id, { beforeRace: !!this.settingUp });
  }
  has(r, p) {
    return this.powers(r).includes(p);
  }
  score(r, n) {
    this.state.scores[r.playerId] += n;
  }
  order() {
    const s = this.state,
      at = s.players.indexOf(s.turnId || s.first);
    const seats = [...s.players.slice(at), ...s.players.slice(0, at)];
    return seats.flatMap((id) => s.racers.filter((r) => r.playerId === id));
  }
  extreme(last = false) {
    const a = this.active();
    if (!a.length) return [];
    const n = (last ? Math.min : Math.max)(...a.map((r) => r.position));
    return this.order().filter((r) => alive(r) && r.position === n);
  }
  options(rs) {
    return rs.map((r) => ({
      value: r.id,
      label: byId[r.racerId].name + '（' + r.position + ' 格）',
    }));
  }
  ask(r, kind, title, options, data = {}, optional = false) {
    if (optional) options = [...options, { value: 'skip', label: '略過' }];
    if (!options.length) return;
    this.state.pending = {
      id: randomUUID(),
      playerId: r.playerId,
      kind,
      title,
      options,
      baseCause: this.baseCause || [],
      ...data,
    };
  }
  beginRace() {
    const s = this.state;
    s.phase = 'racing';
    s.trackId = s.race % 2 ? 'twisty-twirl' : 'whirly-world';
    s.turnId = s.first;
    s.turnCount = 0;
    s.skipperNext = null;
    s.finished = [];
    s.eliminated = [];
    s.doppelDone = false;
    s.twistUsed = false;
    s.twistEffects = [];
    s.twistHistory = [];
    s.direction = 1;
    s.coins = [];
    s.monster = null;
    s.fixed = {};
    s.finale = false;
    s.queue = [];
    s.chainSteps = 0;
    s.pending = null;
    s.context = null;
    s.seen = [];
    s.loopStates = [];
    s.racers = s.players.map((p) => {
      const racerId = s.selections[p];
      s.teams[p] = s.teams[p].filter((r) => r !== racerId);
      return {
        id: randomUUID(),
        racerId,
        playerId: p,
        position: 0,
        tripped: false,
        finished: false,
        eliminated: false,
        copiedPowers: [],
        transformed: false,
      };
    });
    for (const extra of s.persistent) {
      if (!s.racers.some((r) => r.racerId === extra.racerId))
        s.racers.push({
          ...copy(extra),
          id: randomUUID(),
          position: 0,
          tripped: false,
          finished: false,
          eliminated: false,
          krakenUsed: false,
          understudied: false,
          soulmate: null,
          hogs: 0,
        });
    }
    s.persistent = s.persistent.filter((r) => r.racerId === 're-runner');
    this.emit('race-start', '第 ' + s.race + ' 場開始：' + s.trackId);
    this.enqueue(...this.order().map((r) => ({ kind: 'setup', racer: r.id })));
  }
  setup(r) {
    if (base.setup(this, r)) return;
    if (this.has(r, 'understudy') && !r.understudied) {
      this.ask(
        r,
        'understudy',
        '選擇要複製能力的對手',
        this.options(this.active().filter((o) => o.id !== r.id && o.racerId !== 'understudy')),
        { racer: r.id },
      );
      if (this.state.pending) return;
    }
    if (this.has(r, 'nepo-baby')) r.position = 12;
    if (this.has(r, 'hog-knight') && !r.hogs) r.hogs = 1;
    if (this.has(r, 'soulmate') && !r.soulmate)
      this.ask(
        r,
        'soulmate',
        '選擇 Soulmate 的對手',
        this.options(this.active().filter((o) => o.playerId !== r.playerId)),
        { racer: r.id },
      );
  }
  beginPlayerTurn(checkLoop = true) {
    const s = this.state;
    // A forced Skipper can repeatedly take the next turn while other seats
    // never roll. Detect repetition of the forced seat, not only all seats.
    const forced = this.active()
      .filter((r) => r.playerId === s.turnId)
      .every(
        (r) =>
          s.fixed[r.playerId] ||
          this.active().some(
            (o) =>
              o.id !== r.id && this.has(o, 'stunner') && Math.abs(o.position - r.position) <= 1,
          ),
      );
    if (checkLoop && forced) {
      // Scores stay out: points earned inside a loop (e.g. Loveable Loser
      // scoring each lap in last place) must not hide a repeating board.
      const signature = JSON.stringify([
        s.turnId,
        s.nextRacerId,
        s.racers,
        s.twistEffects,
        s.coins,
        s.monster,
        s.direction,
      ]);
      s.loopStates ||= [];
      s.loopStates.push(signature);
      s.loopStates = s.loopStates.slice(-128);
      if (s.loopStates.filter((key) => key === signature).length >= 3) {
        this.ask(
          { playerId: s.first },
          'deadlock',
          '固定骰值下已重複相同賽況，是否形成無法完賽的循環？',
          [
            { value: 'end', label: '裁定結束本場，未取得名次分不發放' },
            { value: 'continue', label: '繼續嘗試其他能力選擇' },
          ],
        );
        return;
      }
    }
    const candidates = s.racers.filter((r) => alive(r) && r.playerId === s.turnId);
    s.playerTurn = s.nextRacerId
      ? candidates.filter((r) => r.id === s.nextRacerId).map((r) => r.id)
      : candidates.map((r) => r.id);
    s.nextRacerId = null;
    s.turnCount++;
    s.chainSteps = 0;
    this.enqueue({ kind: 'player-order' });
  }
  drain() {
    const s = this.state;
    while (s.queue.length && !s.pending && s.phase === 'racing') {
      // The budget spans the whole player turn: answering a choice (e.g. Critic
      // each time a forced Hopfrog extra turn rolls 1) must not restart it.
      s.chainSteps = (s.chainSteps || 0) + 1;
      if (s.chainSteps > 256) {
        this.emit('ruling', '單次連鎖超過安全上限，需裁定是否結束本場。');
        this.ask({ playerId: s.first }, 'ruling', '連鎖需要裁定', [
          { value: 'end', label: '結束本場，未取得名次分不發放' },
        ]);
        break;
      }
      this.run(s.queue.shift());
    }
  }
  run(op) {
    this.baseCause = op.baseCause || [];
    if (base.prepare(this, op) || base.run(this, op)) return;
    const s = this.state,
      r = op.racer ? this.racer(op.racer) : null;
    switch (op.kind) {
      case 'setup':
        if (r && alive(r)) {
          this.settingUp = true;
          try {
            this.setup(r);
          } finally {
            this.settingUp = false;
          }
        }
        break;
      case 'player-order': {
        s.playerTurn = s.playerTurn.filter((id) => alive(this.racer(id)));
        if (!s.playerTurn.length) {
          this.enqueue({ kind: 'player-end' });
          break;
        }
        if (s.playerTurn.length > 1)
          this.ask(
            { playerId: s.turnId },
            'racer-order',
            '選擇先行動的角色',
            this.options(s.playerTurn.map((id) => this.racer(id))),
          );
        else this.startRacer(s.playerTurn.shift());
        break;
      }
      case 'start-power':
        if (r && alive(r) && this.has(r, op.power))
          base.observe(this, r, op.power, () => this.startPower(r, op.power));
        break;
      case 'main':
        if (r && alive(r)) this.main(r);
        break;
      case 'die':
        this.die(op);
        break;
      case 'die-result':
        this.dieResult(op);
        break;
      case 'roll-review':
        this.reviewRoll();
        break;
      case 'nemesis-window':
        this.nemesisWindow(op);
        break;
      case 'main-result':
        this.mainResult();
        break;
      case 'move':
        if (r && alive(r)) this.move(r, op.distance, op);
        break;
      case 'warp':
        this.warp(op.targets);
        break;
      case 'arrive':
        if (r && alive(r)) this.arrive(r, op);
        break;
      case 'trip':
        if (r && alive(r)) {
          r.tripped = true;
          this.emit('trip', byId[r.racerId].name + ' 絆倒', { racer: r.id });
        }
        break;
      case 'finish':
        if (r && !r.eliminated && r.position === 30) this.finishRacer(r);
        break;
      case 'end-racer':
        if (r) this.endRacer(r);
        break;
      case 'end-power':
        if (r && alive(r) && this.has(r, op.power))
          base.observe(this, r, op.power, () => this.endPower(r, op.power));
        break;
      case 'extra-or-next':
        if (r && alive(r) && s.context.extra && !s.skipperNext) this.startRacer(r.id);
        else if (s.twistEffects.includes('curse-wands')) this.enqueue({ kind: 'player-end' });
        else this.enqueue({ kind: 'player-order' });
        break;
      case 'player-end':
        this.endPlayer();
        break;
      case 'next-player':
        this.nextPlayer(op.skip || 0);
        break;
      case 'twist':
        this.twist(op.racer);
        break;
      case 'twist-card':
        this.applyTwist(op.card, op.racer);
        break;
      case 'nemesis-move':
        if (
          r &&
          alive(r) &&
          this.has(r, 'nemesis') &&
          (op.index === undefined
            ? s.context.dice.includes(op.value)
            : s.context.dice[op.index] === op.value)
        )
          this.enqueue({ kind: 'move', racer: r.id, distance: op.value });
        break;
      case 'monster':
        this.monsterMove(op.value);
        break;
    }
  }
  startRacer(id) {
    const s = this.state,
      r = this.racer(id);
    s.context = {
      actor: id,
      startPosition: r.position,
      dice: [],
      total: 0,
      extra: false,
      critics: [],
      nemeses: [],
      recover: false,
    };
    s.seen = [];
    this.emit('turn', byId[r.racerId].name + ' 的回合', { racer: r.id });
    this.enqueue(
      ...this.powers(r).map((power) => ({ kind: 'start-power', racer: id, power })),
      { kind: 'main', racer: id },
      { kind: 'end-racer', racer: id },
    );
  }
  startPower(r, p) {
    base.startPower(this, r, p);
    const s = this.state,
      others = this.active().filter((o) => o.id !== r.id);
    if (p === 'speed-demon' && others.length && others.every((o) => r.position - o.position >= 4))
      this.eliminate(r);
    if (p === 'spoilsport' && others.length && others.every((o) => o.position - r.position >= 5)) {
      this.score(r, 3);
      this.endRace('Spoilsport 取消本場');
    }
    if (p === 'diva') {
      const targets = this.extreme(this.extreme(true).includes(r) ? false : true).filter(
        (o) => o.id !== r.id,
      );
      this.ask(r, 'swap', 'Diva：選擇交換位置的角色', this.options(targets), { racer: r.id });
    }
    if (p === 'kingtripper')
      this.ask(
        r,
        'trip',
        'Kingtripper：是否絆倒領先者？',
        this.options(this.extreme()),
        { racer: r.id },
        true,
      );
    if (p === 'kraken' && !r.krakenUsed)
      this.ask(
        r,
        'kraken',
        'Kraken：是否用掉本場一次的吸引？',
        [{ value: 'yes', label: '傳送所有對手並絆倒' }],
        { racer: r.id },
        true,
      );
    if (p === 'tail') {
      const ahead = others
        .filter((o) => o.position > r.position)
        .sort((a, b) => a.position - b.position);
      if (ahead.length)
        this.ask(
          r,
          'tail',
          'Tail：是否傳到前方最近角色後一格？',
          [{ value: ahead[0].id, label: '傳送到 ' + (ahead[0].position - 1) + ' 格' }],
          { racer: r.id },
          true,
        );
    }
    if (p === 'soulmate') {
      const target = this.racer(r.soulmate);
      if (target && alive(target) && Math.abs(target.position - r.position) <= 5)
        this.enqueue({ kind: 'warp', targets: { [r.id]: target.position } });
    }
  }
  main(r) {
    const s = this.state,
      c = s.context;
    c.recover = r.tripped;
    if (r.tripped && !this.has(r, 'penguin')) {
      r.tripped = false;
      this.emit('recover', byId[r.racerId].name + ' 恢復直立，略過主移動', { racer: r.id });
      return;
    }
    if (c.hareSkipped && this.has(r, 'hare')) {
      base.effect(this, r, 'hare');
      this.emit('power', 'Hare 獨自領先，略過主移動', { racer: r.id });
      return;
    }
    const alternatives = [{ value: 'roll', label: '擲骰主移動' }];
    if (this.has(r, 'legs')) alternatives.push({ value: 'legs', label: 'Legs：主移動五格' });
    if (this.has(r, 'flip-flop') && this.active().some((o) => o.id !== r.id))
      alternatives.push({ value: 'flip-flop', label: 'Flip Flop：交換位置代替主移動' });
    if (this.has(r, 'cheatah'))
      alternatives.push({ value: 'cheatah', label: 'Cheatah：秘密設定數字' });
    if (
      this.has(r, 'mole') &&
      !this.active().some((o) => o.id !== r.id && Math.abs(o.position - r.position) <= 1)
    )
      alternatives.push({ value: 'mole', label: 'Mole：不擲骰，主移動六格' });
    if (alternatives.length > 1)
      this.ask(r, 'main-mode', '選擇主移動方式', alternatives, { racer: r.id });
    else this.beginRoll(r);
  }
  beginRoll(r) {
    const s = this.state,
      c = s.context;
    if (!c.rollStyle) {
      const styles = ['mr-dice-guy', 'show-off', 'magical-athlete'].filter((p) => this.has(r, p));
      if (styles.length > 1) {
        this.ask(
          r,
          'roll-style',
          '主移動擲骰能力衝突，選擇本回合使用的方式',
          styles.map((p) => ({ value: p, label: byId[p].name + '：' + byId[p].summary })),
          { racer: r.id },
        );
        return;
      }
      c.rollStyle = styles[0] || 'normal';
    }
    c.dice = [];
    c.magicianDeclined = c.dealerDeclined = false;
    c.baseProcessed = false;
    c.styleNotified = false;
    delete c.baseTotal;
    c.critics = [];
    c.bust = false;
    c.showingExtra = false;
    const count = c.rollStyle === 'mr-dice-guy' ? 6 : 1;
    this.enqueue(
      ...Array.from({ length: count }, () => ({ kind: 'die', racer: r.id, purpose: 'main' })),
      { kind: 'roll-review' },
    );
  }
  die(op) {
    const s = this.state,
      r = this.racer(op.racer);
    if (!r || (!alive(r) && op.purpose !== 'curse')) return;
    const raw = s.fixed[r.playerId] || randomInt(1, 7);
    let step;
    if (alive(r)) step = mandatoryDieStep(s.racers, r.id, raw);
    else {
      const value = this.active().some(
        (o) => this.has(o, 'stunner') && Math.abs(o.position - r.position) <= 1,
      )
        ? 1
        : raw;
      const poopers = this.active().filter((o) => this.has(o, 'party-pooper'));
      const reroll = value === 6 && poopers.length > 0;
      step = {
        reroll,
        candidateValue: reroll ? null : value,
        reactions: reroll ? poopers.map((o) => ({ racerId: o.id, distance: 1 })) : [],
      };
    }
    if (step.reroll) {
      this.emit('reroll', byId[r.racerId].name + ' 的 6 作廢，Party Pooper 前進後重擲', {
        racer: r.id,
      });
      // Fixed six + Party Pooper cannot resolve: do not generate an endless queue.
      if (s.fixed[r.playerId] === 6) {
        this.emit(
          'loop',
          '固定六與強制重擲形成循環：Party Pooper 反應完成一次，本次擲骰沒有可用結果',
          { racer: r.id },
        );
        this.enqueue(
          ...step.reactions.map((o) => ({ kind: 'move', racer: o.racerId, distance: o.distance })),
          { ...op, kind: 'die-result', value: 0 },
        );
        return;
      }
      this.enqueue(
        ...step.reactions.map((o) => ({ kind: 'move', racer: o.racerId, distance: o.distance })),
        op,
      );
    } else {
      this.emit('die', byId[r.racerId].name + ' 擲出 ' + step.candidateValue, {
        racer: r.id,
        value: step.candidateValue,
        purpose: op.purpose,
      });
      this.enqueue({ ...op, kind: 'die-result', value: step.candidateValue });
    }
  }
  dieResult(op) {
    const s = this.state,
      r = this.racer(op.racer),
      c = s.context;
    if (base.dieResult(this, op)) return;
    if (op.purpose === 'main') {
      c.dice.push(op.value);
      if (!op.value) c.bust = true;
      this.enqueue({ kind: 'nemesis-window', index: c.dice.length - 1, offered: [] });
    }
    if (op.purpose === 'show-off') {
      c.dice.push(op.value);
      c.showingExtra = true;
      c.critics = [];
      this.enqueue(
        { kind: 'nemesis-window', index: c.dice.length - 1, offered: [] },
        { kind: 'roll-review' },
      );
    }
    if (op.purpose === 'nemesis') {
      c.nemeses.push({ racer: r.id, value: op.value, index: op.index });
      this.enqueue(op.continuation);
    }
    if (op.purpose === 'hose')
      this.enqueue(
        ...this.active()
          .filter((o) => o.position > r.position && o.position <= r.position + op.value)
          .map((o) => ({ kind: 'trip', racer: o.id })),
      );
    if (op.purpose === 'curse') this.enqueue({ kind: 'next-player', skip: op.value });
    if (op.purpose === 'monster') this.enqueue({ kind: 'monster', value: op.value });
    if (op.purpose === 'fixed') s.fixed[r.playerId] = op.value;
  }
  nemesisWindow(op) {
    const s = this.state,
      c = s.context,
      actor = this.racer(c.actor);
    if (!alive(actor)) return;
    const nemesis = this.order().find(
      (o) => o.id !== actor.id && this.has(o, 'nemesis') && !op.offered.includes(o.id),
    );
    if (nemesis)
      this.ask(
        nemesis,
        'nemesis',
        'Nemesis：是否跟擲第 ' + (op.index + 1) + ' 顆主移動骰？',
        [{ value: 'yes', label: '跟擲，相同點數時跟隨移動' }],
        {
          racer: nemesis.id,
          index: op.index,
          continuation: { ...op, offered: [...op.offered, nemesis.id] },
        },
        true,
      );
  }
  reviewRoll() {
    const s = this.state,
      c = s.context,
      r = this.racer(c.actor);
    if (!alive(r)) return;
    c.criticUsed ||= [];
    const critic = this.order().find(
      (o) =>
        o.id !== r.id &&
        this.has(o, 'critic') &&
        r.position > o.position &&
        !c.critics.includes(o.id) &&
        !c.criticUsed.includes(o.id),
    );
    if (critic) {
      c.critics.push(critic.id);
      this.ask(
        critic,
        'critic',
        'Critic：是否令前方角色重擲？',
        [{ value: 'yes', label: '作廢整次擲骰並重擲' }],
        { racer: r.id, critic: critic.id },
        true,
      );
      return;
    }
    if (base.reviewRoll(this)) return;
    if (c.showingExtra) {
      c.showingExtra = false;
      if (c.dice.at(-1) <= c.dice.at(-2)) {
        c.total = 0;
        c.bust = true;
        this.enqueue({ kind: 'main-result' });
      } else this.showOff(r);
      return;
    }
    if (c.rollStyle === 'mr-dice-guy' || (!c.rollStyle && this.has(r, 'mr-dice-guy'))) {
      const options = [...new Set(c.dice)]
        .filter((n) => c.dice.filter((v) => v === n).length > 1)
        .map((n) => ({ value: String(n), label: String(n) + ' 格' }));
      if (options.length) this.ask(r, 'dice-pick', 'Mr. Dice Guy：選擇重複出現的點數', options);
      else {
        c.total = 0;
        c.bust = true;
        this.enqueue({ kind: 'main-result' });
      }
    } else if (c.rollStyle === 'show-off' || (!c.rollStyle && this.has(r, 'show-off')))
      this.showOff(r);
    else {
      c.total = c.dice[0] || 0;
      this.enqueue({ kind: 'main-result' });
    }
  }
  showOff(r) {
    const c = this.state.context;
    this.ask(
      r,
      'show-off',
      'Show-Off：目前 ' + c.dice.join(' + ') + '，繼續須大於 ' + c.dice.at(-1),
      [
        { value: 'stop', label: '停止，移動 ' + c.dice.reduce((a, b) => a + b, 0) + ' 格' },
        ...(c.dice.at(-1) < 6 ? [{ value: 'again', label: '再擲一次' }] : []),
      ],
      { racer: r.id },
    );
  }
  mainResult() {
    const s = this.state,
      c = s.context,
      r = this.racer(c.actor);
    if (!alive(r)) return;
    if (base.mainResult(this)) return;
    if (c.rollStyle && c.rollStyle !== 'normal' && !c.styleNotified) {
      c.styleNotified = true;
      this.enqueue(
        { kind: 'base-effect', racer: r.id, power: c.rollStyle, ops: [] },
        { kind: 'main-result' },
      );
      return;
    }
    if (this.has(r, 'mush'))
      for (const value of c.dice)
        if (value >= 1 && value <= 2 && s.reserve.length) {
          const power = s.reserve.shift();
          r.copiedPowers.push(power);
          this.emit('power', 'Mush 獲得 ' + byId[power].name, { racer: r.id });
        }
    if (this.has(r, 'icarus') && c.dice.includes(6)) {
      this.eliminate(r);
      this.afterMain();
      return;
    }
    if (this.has(r, 'bite-mark') && c.dice.some((n) => n >= 1 && n <= 2)) {
      r.transformed = true;
      this.emit('power', 'Bite Mark 變身', { racer: r.id });
    }
    if (c.bust) {
      this.emit('power', '本次擲骰沒有有效移動結果', { racer: r.id });
      this.afterMain();
      return;
    }
    if (
      (c.rollStyle === 'magical-athlete' || (!c.rollStyle && this.has(r, 'magical-athlete'))) &&
      this.has(r, 'magical-athlete') &&
      c.dice.length
    ) {
      const value = c.dice[0];
      if (value === 1) c.total = 7;
      if (value === 2) {
        this.enqueue({
          kind: 'warp',
          targets: Object.fromEntries(this.extreme(true).map((o) => [o.id, r.position])),
        });
        this.afterMain();
        return;
      }
      if (value === 3) {
        this.ask(
          r,
          'athlete-warp',
          'Magical Athlete：傳到另一名角色並絆倒',
          this.options(this.active().filter((o) => o.id !== r.id)),
          { racer: r.id },
        );
        if (s.pending) return;
        c.total = 0;
      }
      if (value === 4) {
        c.total = 4;
        c.extra = true;
      }
      if (value === 5) {
        this.enqueue(...this.extreme().map((o) => ({ kind: 'move', racer: o.id, distance: -5 })));
        this.afterMain();
        return;
      }
      if (value === 6) {
        c.total = 6;
        c.tripPassed = true;
      }
    }
    this.performMain(r, c.total);
  }
  performMain(r, amount) {
    const s = this.state,
      c = s.context;
    const beforeBaseModifiers = s.queue.length;
    let distance = c.baseTotal ?? amount,
      reverse = false;
    // Main-move modifiers apply in racer turn order, including multiplication/reversal.
    for (const source of [r, ...this.order().filter((o) => o.id !== r.id)]) {
      if (source.id === r.id) {
        for (const p of this.powers(r)) {
          const priorDistance = distance,
            priorReverse = reverse;
          if (p === 'blunderdog') {
            if (this.extreme(true).includes(r)) distance *= 3;
            else reverse = !reverse;
          }
          if (p === 'gloth') distance--;
          if (p === 'icarus') distance += 3;
          if (p === 'overtaker')
            distance += this.active().filter((o) => o.position > r.position).length;
          if (p === 'speed-demon') distance += s.scores[r.playerId];
          if (p === 'penguin' && c.recover) distance *= 2;
          if (distance !== priorDistance || reverse !== priorReverse) base.notify(this, r, p);
        }
        distance += (r.hogs || 0) * 2;
      } else {
        if (this.has(source, 'le-saboteur') && c.dice.includes(3)) {
          reverse = !reverse;
          base.notify(this, source, 'le-saboteur');
        }
        if (this.has(source, 'null') && source.position < r.position) {
          distance--;
          base.notify(this, source, 'null');
        }
        if (this.has(source, 'stepdad') && this.stepchild(source)?.id === r.id) {
          distance += 2;
          base.notify(this, source, 'stepdad');
        }
      }
    }
    distance = base.modifier(this, r, distance);
    const modifierEffects = s.queue.splice(0, s.queue.length - beforeBaseModifiers);
    if (s.twistEffects.includes('conveyor')) distance += 3;
    if (reverse) distance *= -1;
    if (s.twistEffects.includes('scrying-pool') && distance >= 6) this.eliminate(r);
    else
      this.enqueue(...modifierEffects, {
        kind: 'move',
        racer: r.id,
        distance,
        main: true,
        tripPassed: c.tripPassed,
      });
    this.afterMain();
  }
  afterMain() {
    const c = this.state.context;
    // Append after the actor's movement, before end-of-turn powers.
    const effects = c.nemeses.map((n) => ({ kind: 'nemesis-move', ...n }));
    const endAt = this.state.queue.findIndex((op) => op.kind === 'end-racer');
    this.state.queue.splice(endAt < 0 ? this.state.queue.length : endAt, 0, ...effects);
  }
  stepchild(r) {
    const ordered = this.order(),
      i = ordered.indexOf(r);
    for (let n = 1; n < ordered.length; n++) {
      const o = ordered[(i + n) % ordered.length];
      if (!o.eliminated) return o;
    }
    return null;
  }
  move(r, distance, meta = {}) {
    if (base.beforeMove(this, r, distance, meta)) return;
    const planned = base.plan(this, r, distance, meta);
    if (planned.blocked) return;
    distance = planned.to - r.position;
    const s = this.state,
      from = r.position,
      to = Math.max(0, Math.min(30, from + distance));
    if (from === to) return;
    const passed = this.order()
      .filter(
        (o) =>
          o.id !== r.id &&
          alive(o) &&
          ((from < o.position && to > o.position) || (from > o.position && to < o.position)),
      )
      .sort((a, b) => Math.sign(to - from) * (a.position - b.position));
    r.position = to;
    this.emit('move', byId[r.racerId].name + '：' + from + ' → ' + to, { racer: r.id, from, to });
    const effects = [];
    if (
      s.trackId === 'twisty-twirl' &&
      !s.twistUsed &&
      ((from < 14 && to >= 14) || (from > 14 && to <= 14))
    ) {
      s.twistUsed = true;
      effects.push({ kind: 'twist', racer: r.id });
    }
    let streakScored = false;
    for (const other of passed) {
      // Passing powers inspect the crossing, rather than retroactively suppressing
      // earlier passes because the mover eventually ended beyond NULL.
      r.position = other.position + Math.sign(to - from);
      if (this.has(other, 'penguin'))
        effects.push({ kind: 'trip', racer: other.id }, ...base.reactions(this, other, 'penguin'));
      if (r.transformed && this.has(r, 'bite-mark')) this.eliminate(other);
      if (meta.tripPassed) effects.push({ kind: 'trip', racer: other.id });
      if (!streakScored && this.has(r, 'streaker')) {
        this.score(r, 1);
        streakScored = true;
      }
    }
    r.position = to;
    base.afterMove(this, r, passed, meta, from, to, effects, 'passes');
    effects.push(
      to === 30
        ? { kind: 'finish', racer: r.id }
        : {
            kind: 'arrive',
            racer: r.id,
            simultaneous: meta.simultaneous || !!meta.followers?.length,
          },
    );
    base.afterMove(this, r, passed, meta, from, to, effects, 'followers');
    this.enqueue(...effects);
  }
  warp(targets) {
    const moved = [],
      simultaneous = Object.keys(targets).length > 1;
    for (const [id, position] of Object.entries(targets)) {
      const r = this.racer(id);
      if (!r || !alive(r) || r.position === position) continue;
      const from = r.position;
      r.position = Math.max(0, Math.min(30, position));
      this.emit('warp', byId[r.racerId].name + ' 傳送：' + from + ' → ' + r.position, {
        racer: r.id,
      });
      moved.push({ kind: r.position === 30 ? 'finish' : 'arrive', racer: id, simultaneous });
    }
    this.enqueue(...moved);
  }
  arrive(r, op) {
    const s = this.state,
      key = r.id + ':' + r.position;
    if (s.seen.includes(key)) return;
    s.seen.push(key);
    if (base.arrive(this, r, op)) return;
    const pair = tracks[s.trackId].portals
      .map((p) => (s.direction === -1 ? p.map((n) => 30 - n) : p))
      .find((p) => p.includes(r.position));
    const portalKey = pair ? r.id + ':whirl:' + pair[0] : null;
    if (pair && !s.seen.includes(portalKey)) {
      s.seen.push(portalKey);
      this.enqueue({ kind: 'warp', targets: { [r.id]: pair.find((n) => n !== r.position) } });
      return;
    }
    if (s.twistEffects.includes('bonkbug') && r.position >= 28) {
      this.enqueue({ kind: 'move', racer: r.id, distance: -5 });
      return;
    }
    if (s.coins.includes(r.position)) {
      s.coins.splice(s.coins.indexOf(r.position), 1);
      this.score(r, 1);
    }
    if (op.simultaneous) return;
    for (const other of this.order()) {
      if (other.id === r.id || !alive(other) || other.position !== r.position) continue;
      if (other.hogs) {
        r.hogs = (r.hogs || 0) + other.hogs;
        other.hogs = 0;
      }
      if (this.has(other, 'hotel')) {
        if (s.scores[r.playerId] > 0) {
          this.score(r, -1);
          this.score(other, 1);
          this.emit('power', byId[r.racerId].name + ' 支付 Hotel 一分', { racer: r.id });
        } else this.enqueue({ kind: 'trip', racer: r.id });
      }
    }
  }
  eliminate(r) {
    if (!alive(r)) return;
    r.eliminated = true;
    this.state.eliminated.push(r.id);
    this.emit('eliminate', byId[r.racerId].name + ' 淘汰', { racer: r.id });
    this.checkRace();
  }
  finishRacer(r) {
    const s = this.state;
    if (r.finished || r.eliminated || s.phase !== 'racing') return;
    if (!s.finished.length && !s.doppelDone) {
      const copies = this.order().filter((o) => this.has(o, 'doppelgangster'));
      if (copies.length) {
        s.doppelDone = true;
        for (const d of copies) if (d.id !== r.id) d.copiedPowers.push(r.racerId);
        this.eliminate(r);
        return;
      }
    }
    if (!s.finished.length)
      for (const o of this.order())
        if (this.has(o, 'stepdad') && this.stepchild(o)?.id === r.id) this.score(o, 3);
    const masterminds = this.order().filter((o) => this.has(o, 'mastermind'));
    r.finished = true;
    s.finished.push(r.id);
    const rank = s.finished.length;
    base.finish(this, r, masterminds);
    this.emit('finish', byId[r.racerId].name + ' 獲得第 ' + rank + ' 名', {
      racer: r.id,
    });
    if (s.finished.length >= 2) this.endRace('前兩名已抵達');
    else this.checkRace();
  }
  checkRace() {
    const s = this.state;
    if (s.phase !== 'racing') return;
    const a = this.active();
    if (a.length <= 1) {
      if (a.length) {
        a[0].finished = true;
        s.finished.push(a[0].id);
      }
      this.endRace('僅剩一名或沒有在場角色');
    }
  }
  endRace(reason) {
    const s = this.state;
    if (s.phase !== 'racing') return;
    if (s.twistEffects.includes('season-finale') && s.finished.length === 2 && !s.finale) {
      s.finale = true;
      s.finalists = [...s.finished];
      s.finished = [];
      s.queue = [];
      s.pending = null;
      for (const r of s.racers) {
        r.eliminated = !s.finalists.includes(r.id);
        r.finished = false;
        if (!r.eliminated) {
          r.position = 15;
          r.tripped = false;
        }
      }
      s.turnId = this.racer(s.finalists[0]).playerId;
      this.emit('finale', 'Season Finale：前兩名從第二彎角進行決賽');
      return;
    }
    const ranking = s.finished.map((id, index) => {
      const r = this.racer(id),
        points = s.finale
          ? index === 0
            ? awards[s.race - 1][0] + awards[s.race - 1][1]
            : 0
          : awards[s.race - 1][index] || 0;
      this.score(r, points);
      return { playerId: r.playerId, racerId: r.racerId, rank: index + 1, points };
    });
    for (const r of s.racers) {
      if (this.has(r, 'gloth') && r.position <= 15) this.score(r, 3);
      if (r.racerId === 're-runner' && !s.persistent.some((o) => o.racerId === r.racerId))
        s.persistent.push(copy(r));
    }
    const firstEliminated = s.eliminated.length ? this.racer(s.eliminated[0]) : null;
    const trailing = this.order()
      .filter((r) => !r.finished && !r.eliminated)
      .sort((a, b) => a.position - b.position)[0];
    s.first = (firstEliminated || trailing || this.racer(s.finished.at(-1)))?.playerId || s.first;
    s.results.push({ race: s.race, trackId: s.trackId, ranking, reason, scores: copy(s.scores) });
    s.phase = s.race === 4 ? 'finished' : 'race-result';
    s.queue = [];
    s.pending = null;
    this.emit('race-end', reason);
  }
  endRacer(r) {
    const s = this.state;
    if (s.context.recover) r.tripped = false;
    this.enqueue(
      ...this.powers(r).map((power) => ({ kind: 'end-power', racer: r.id, power })),
      {
        kind: 'base-end',
        racer: r.id,
      },
      {
        kind: 'extra-or-next',
        racer: r.id,
      },
    );
  }
  endPower(r, p) {
    const s = this.state;
    if (
      p === 'hopfrog' &&
      this.active().some((o) => o.id !== r.id && o.position === r.position + 1)
    )
      s.context.extra = true;
    if (p === 'the-hose') this.enqueue({ kind: 'die', racer: r.id, purpose: 'hose' });
    if (p === 'switcharoo')
      this.ask(
        r,
        'control',
        'Switcharoo：是否交換角色控制權？',
        this.options(
          this.active().filter(
            (o) => o.playerId !== r.playerId && Math.abs(o.position - r.position) <= 1,
          ),
        ),
        { racer: r.id },
        true,
      );
  }
  endPlayer() {
    const s = this.state;
    if (s.monster !== null) {
      const r = this.active()[0];
      if (r) this.enqueue({ kind: 'die', racer: r.id, purpose: 'monster' });
    }
    if (s.twistEffects.includes('curse-wands')) {
      const r = this.racer(s.context.actor);
      this.state.queue.push({ kind: 'die', racer: r.id, purpose: 'curse' });
    } else this.state.queue.push({ kind: 'next-player' });
  }
  nextPlayer(skip) {
    const s = this.state;
    if (s.skipperNext) {
      const next = this.racer(s.skipperNext);
      s.skipperNext = null;
      if (next && alive(next)) {
        s.turnId = next.playerId;
        s.nextRacerId = next.id;
        return;
      }
    }
    if (s.twistEffects.includes('curse-wands')) {
      const slots = s.players.flatMap((id) => s.racers.filter((r) => r.playerId === id));
      const at = slots.findIndex((r) => r.id === s.context.actor);
      const next = slots[(at + 1 + skip) % slots.length];
      s.turnId = next.playerId;
      if (alive(next)) s.nextRacerId = next.id;
      else {
        s.context = { actor: next.id };
        this.enqueue({ kind: 'player-end' });
      }
      return;
    }
    let i = (s.players.indexOf(s.turnId) + 1 + skip) % s.players.length;
    for (let n = 0; n < s.players.length; n++, i = (i + 1) % s.players.length)
      if (s.racers.some((r) => alive(r) && r.playerId === s.players[i])) {
        s.turnId = s.players[i];
        return;
      }
    this.checkRace();
  }
  twist(racer) {
    const card = this.state.twistDeck.shift();
    if (card) this.enqueue({ kind: 'twist-card', card, racer });
  }
  applyTwist(card, actor) {
    const s = this.state,
      r = this.racer(actor);
    s.twistHistory.push(card);
    this.emit('twist', twists.find((t) => t.id === card).summary, {
      card,
      ...(r ? { racer: r.id } : {}),
    });
    if (['bonkbug', 'curse-wands', 'conveyor', 'scrying-pool', 'season-finale'].includes(card))
      s.twistEffects.push(card);
    if (card === 'fans-demand-chaos')
      this.enqueue({ kind: 'twist', racer: actor }, { kind: 'twist', racer: actor });
    if (card === 'conveyor')
      this.enqueue({
        kind: 'warp',
        targets: Object.fromEntries(this.active().map((o) => [o.id, 1])),
      });
    if (card === 'pinata')
      s.coins = Array.from({ length: 17 }, (_, i) => i + 13).filter(
        (p) => !this.active().some((o) => o.position === p),
      );
    if (card === 'alchemy-lab') s.monster = 0;
    if (card === 'mirror-world') {
      // Coordinates always measure progress toward the CURRENT finish, reversing physical whirls too.
      s.direction *= -1;
      const targets = Object.fromEntries(
        this.order()
          .filter(alive)
          .map((o) => [o.id, 30 - o.position]),
      );
      this.enqueue({ kind: 'warp', targets });
    }
    if (card === 'roast-chicken')
      this.enqueue(...this.extreme(true).map((o) => ({ kind: 'move', racer: o.id, distance: 7 })));
    if (card === 'time-imp' && r && alive(r)) {
      s.persistent.push(copy(r));
      this.eliminate(r);
    }
    if (card === 'randomness-ceased')
      this.enqueue(
        ...s.players
          .map((p) => this.active().find((o) => o.playerId === p))
          .filter(Boolean)
          .map((o) => ({ kind: 'die', racer: o.id, purpose: 'fixed' })),
      );
    if (card === 'swap-meet') {
      s.swapChoices = {};
      s.swapOffers = {};
      for (const p of s.players) {
        const current = this.active().find((o) => o.playerId === p);
        if (current && s.reserve.length)
          s.swapOffers[p] = { racer: current.id, card: s.reserve.shift() };
      }
      this.swapNext();
    }
  }
  swapNext() {
    const s = this.state,
      player = s.players.find((p) => s.swapOffers[p] && !Object.hasOwn(s.swapChoices, p));
    if (player) {
      const offer = s.swapOffers[player];
      this.ask({ playerId: player }, 'swap-meet', 'Swap Meet：秘密決定是否替換角色', [
        { value: 'keep', label: '保留目前角色' },
        { value: 'swap', label: '換成 ' + byId[offer.card].name },
      ]);
    } else {
      const setups = [];
      for (const [p, value] of Object.entries(s.swapChoices))
        if (value === 'swap') {
          const offer = s.swapOffers[p],
            r = this.racer(offer.racer);
          r.racerId = offer.card;
          r.copiedPowers = [];
          r.transformed = false;
          r.understudied = false;
          r.soulmate = null;
          setups.push({ kind: 'setup', racer: r.id });
        }
      s.swapOffers = {};
      s.swapChoices = {};
      this.enqueue(...setups);
    }
  }
  monsterMove(value) {
    const s = this.state,
      from = s.monster;
    s.monster = Math.min(30, from + value);
    for (const r of this.active())
      if (from < r.position && s.monster > r.position) this.eliminate(r);
    if (s.monster === 30) s.monster = null;
  }
  choose(p, value) {
    this.baseCause = p.baseCause || [];
    if (base.choose(this, p, value)) return;
    if (p.powerOrigin && !p.powerObserved) {
      base.observe(
        this,
        this.racer(p.powerOrigin.racer),
        p.powerOrigin.power,
        () => this.choose({ ...p, powerObserved: true }, value),
        true,
      );
      return;
    }
    const s = this.state,
      r = p.racer ? this.racer(p.racer) : null,
      c = s.context;
    if (p.kind === 'ruling') {
      this.endRace('連鎖裁定結束');
      return;
    }
    if (p.kind === 'deadlock') {
      if (value === 'end') this.endRace('固定骰值的重複賽況，經玩家裁定無法完賽');
      else {
        s.loopStates = [];
        this.beginPlayerTurn(false);
      }
      return;
    }
    if (p.kind === 'racer-order') {
      s.playerTurn.splice(s.playerTurn.indexOf(value), 1);
      this.startRacer(value);
      return;
    }
    if (p.kind === 'swap-meet') {
      s.swapChoices[p.playerId] = value;
      this.swapNext();
      return;
    }
    if (p.kind === 'critic') {
      if (value === 'yes') {
        c.criticUsed.push(p.critic);
        this.beginRoll(r);
        c.nemeses = [];
      } else this.enqueue({ kind: 'roll-review' });
      return;
    }
    if (p.kind === 'nemesis') {
      if (value === 'yes')
        this.enqueue({
          kind: 'die',
          racer: r.id,
          purpose: 'nemesis',
          index: p.index,
          continuation: p.continuation,
        });
      else this.enqueue(p.continuation);
      return;
    }
    if (value === 'skip') return;
    if (p.kind === 'understudy') {
      r.copiedPowers = [this.racer(value).racerId];
      r.understudied = true;
      this.enqueue({ kind: 'setup', racer: r.id });
    }
    if (p.kind === 'soulmate') r.soulmate = value;
    if (p.kind === 'trip') this.enqueue({ kind: 'trip', racer: value });
    if (p.kind === 'swap') {
      const o = this.racer(value);
      this.enqueue({ kind: 'warp', targets: { [r.id]: o.position, [o.id]: r.position } });
    }
    if (p.kind === 'kraken') {
      r.krakenUsed = true;
      const others = this.active().filter((o) => o.id !== r.id);
      this.enqueue(
        { kind: 'warp', targets: Object.fromEntries(others.map((o) => [o.id, r.position])) },
        ...others.map((o) => ({ kind: 'trip', racer: o.id })),
      );
    }
    if (p.kind === 'tail')
      this.enqueue({ kind: 'warp', targets: { [r.id]: this.racer(value).position - 1 } });
    if (p.kind === 'control') {
      const o = this.racer(value),
        owner = r.playerId;
      r.playerId = o.playerId;
      o.playerId = owner;
    }
    if (p.kind === 'main-mode') {
      if (value === 'legs')
        base.effect(this, r, 'legs', [{ kind: 'base-fixed-main', racer: r.id, amount: 5 }]);
      if (value === 'flip-flop')
        this.ask(
          r,
          'base-flip',
          'Flip Flop：選擇交換位置的對手',
          this.options(this.active().filter((o) => o.id !== r.id)),
          { racer: r.id },
          true,
        );
      if (value === 'roll') this.beginRoll(r);
      if (value === 'mole') {
        c.total = 6;
        this.performMain(r, 6);
      }
      if (value === 'cheatah')
        this.ask(
          r,
          'cheatah-secret',
          '秘密設定主移動數字',
          Array.from({ length: 6 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
          { racer: r.id },
        );
    }
    if (p.kind === 'roll-style') {
      c.rollStyle = value;
      this.beginRoll(r);
    }
    if (p.kind === 'cheatah-secret') {
      s.secretNumber = Number(value);
      const at = s.players.indexOf(r.playerId),
        right = s.players[(at + s.players.length - 1) % s.players.length];
      this.ask(
        { playerId: right },
        'cheatah-guess',
        '猜 Cheatah 秘密設定的數字',
        Array.from({ length: 6 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
        { racer: r.id },
      );
    }
    if (p.kind === 'cheatah-guess') {
      const amount = Number(value) === s.secretNumber ? 0 : s.secretNumber;
      this.emit('power', 'Cheatah 設定 ' + s.secretNumber + '，對手猜 ' + value, { racer: r.id });
      delete s.secretNumber;
      c.total = amount;
      if (amount) this.performMain(r, amount);
    }
    if (p.kind === 'dice-pick') {
      c.total = Number(value);
      this.enqueue({ kind: 'main-result' });
    }
    if (p.kind === 'show-off') {
      if (value === 'again') this.enqueue({ kind: 'die', racer: r.id, purpose: 'show-off' });
      else {
        c.total = c.dice.reduce((a, b) => a + b, 0);
        this.enqueue({ kind: 'main-result' });
      }
    }
    if (p.kind === 'athlete-warp') {
      const target = this.racer(value);
      this.enqueue(
        { kind: 'warp', targets: { [r.id]: target.position } },
        ...this.active()
          .filter((o) => o.id !== r.id && o.position === target.position)
          .map((o) => ({ kind: 'trip', racer: o.id })),
      );
      this.afterMain();
    }
  }
  view(id) {
    if (!this.state) {
      const draft = this.draft.view(id);
      return {
        ...draft,
        ...(['choosing', 'race-ready'].includes(draft.phase) ? { race: 1 } : {}),
        stage: 'recruiting',
        catalog: this.catalog,
        racerSet: this.racerSet,
        awards,
        awardStatus: 'user-approved-provisional',
      };
    }
    const s = this.state;
    if (!s.players.includes(id)) fail('NOT_SEATED', '尚未入座', 403);
    return copy({
      type: 'second-wind',
      revision: s.revision,
      phase: s.phase,
      race: s.race,
      turnId: s.phase === 'racing' ? s.turnId : null,
      first: s.first,
      players: s.players,
      teams: s.teams,
      selectedIds: Object.keys(s.selections),
      ownSelection: s.selections[id] || null,
      scores: s.scores,
      racers: s.racers,
      catalog: this.catalog,
      racerSet: this.racerSet,
      awards,
      awardStatus: 'user-approved-provisional',
      trackId: s.trackId,
      direction: s.direction,
      twistHistory: s.twistHistory,
      twistEffects: s.twistEffects,
      twistCards: s.twistHistory.map((id) => ({
        id,
        summary: twists.find((t) => t.id === id).summary,
      })),
      coins: s.coins,
      monster: s.monster,
      pending: s.pending
        ? {
            id: s.pending.id,
            playerId: s.pending.playerId,
            title: s.pending.playerId === id ? s.pending.title : '等待玩家完成能力選擇',
            options: s.pending.playerId === id ? s.pending.options : [],
          }
        : null,
      events: s.events,
      results: s.results,
      winners:
        s.phase === 'finished'
          ? s.players.filter((p) => s.scores[p] === Math.max(...Object.values(s.scores)))
          : [],
    });
  }
}
module.exports = { SecondWindGame, awards };
