'use strict';
const { allRacers } = require('./catalog');
const baseIds = new Set(require('./base-catalog').baseRacers.map((r) => r.id));
const names = Object.fromEntries(allRacers.map((r) => [r.id, r.name]));
const live = (r) => r && !r.finished && !r.eliminated;
const own = (r) => [r.racerId, ...(r.copiedPowers || [])];
const move = (r, distance, extra = {}) => ({ kind: 'move', racer: r.id, distance, ...extra });
function effect(g, r, power, ops = []) {
  g.enqueue({ kind: 'base-effect', racer: r.id, power, ops });
}
function reactions(g, r, power) {
  const cause = [...(g.baseCause || []), `${r.id}:${power}`];
  return g
    .order()
    .filter((o) => o.id !== r.id && g.has(o, 'scoocher'))
    .map((o) => ({
      kind: 'base-effect',
      racer: o.id,
      power: 'scoocher',
      baseCause: cause,
      ops: [move(o, 1)],
    }));
}
function prepare(g, op) {
  if (op.kind === 'setup') return false;
  for (const r of g.order()) {
    if (!g.has(r, 'copy-cat')) continue;
    const leaders = g.extreme();
    const key = leaders
      .map((o) => o.id)
      .sort()
      .join(':');
    if (r.copyLeaderKey === key) continue;
    r.copyLeaderKey = key;
    if (leaders.length === 1) r.copyTarget = leaders[0].id;
    else if (leaders.length) {
      g.enqueue(op);
      g.ask(r, 'base-copy', 'Copy Cat：選擇並列領先者的能力', g.options(leaders), { racer: r.id });
      return true;
    }
  }
  return false;
}
function setup(g, r) {
  const direct = own(r);
  if (direct.includes('egg') && !r.eggResolved) {
    r.eggResolved = true;
    const cards = g.state.reserve.splice(0, 3);
    if (cards.length) {
      g.ask(
        r,
        'base-egg',
        'Egg：選擇要取得能力的角色',
        cards.map((id) => ({ value: id, label: names[id] })),
        { racer: r.id },
      );
      return true;
    }
    g.emit('ruling', 'Egg：未招募牌庫已空，沒有新能力可選', { racer: r.id });
  }
  if (direct.includes('twin') && !r.twinResolved) {
    r.twinResolved = true;
    const winners = [
      ...new Set(
        g.state.results.flatMap((v) => v.ranking.filter((x) => x.rank === 1).map((x) => x.racerId)),
      ),
    ];
    if (winners.length) {
      g.ask(
        r,
        'base-twin',
        'Twin：可複製先前賽事冠軍',
        winners.map((id) => ({ value: id, label: names[id] })),
        { racer: r.id },
        true,
      );
      return true;
    }
  }
  if (direct.includes('sisyphus') && !r.sisyphusGranted) {
    r.sisyphusGranted = true;
    g.score(r, 4);
    g.emit('power', 'Sisyphus 開賽獲得四分', { racer: r.id });
  }
  return false;
}
function startPower(g, r, p) {
  const s = g.state,
    c = s.context;
  if (p === 'duelist')
    g.enqueue(
      ...g
        .active()
        .filter((o) => o.id !== r.id && o.position === r.position)
        .map((o) => ({ kind: 'base-duel-offer', racer: r.id, opponent: o.id })),
    );
  if (p === 'blimp') c.blimpBonus = r.position < 15 ? 3 : -1;
  if (p === 'hare') c.hareSkipped = g.extreme().length === 1 && g.extreme()[0].id === r.id;
  if (p === 'loveable-loser' && g.extreme(true).length === 1 && g.extreme(true)[0].id === r.id) {
    g.score(r, 1);
    effect(g, r, p);
  }
  if (p === 'cheerleader')
    g.ask(
      r,
      'base-cheer',
      'Cheerleader：是否鼓舞最後方角色？',
      [{ value: 'yes', label: '最後方各前進二，自己再前進一' }],
      { racer: r.id },
      true,
    );
  if (p === 'hypnotist')
    g.ask(
      r,
      'base-hypnotist',
      'Hypnotist：可傳送一位對手到自己格上',
      g.options(g.active().filter((o) => o.id !== r.id)),
      { racer: r.id },
      true,
    );
  if (p === 'third-wheel') {
    const targets = g
      .active()
      .filter((o) => g.active().filter((v) => v.position === o.position).length === 2);
    const unique = [...new Set(targets.map((o) => o.position))];
    g.ask(
      r,
      'base-third',
      'Third Wheel：可傳送到恰有兩人的格子',
      unique.map((n) => ({ value: String(n), label: `第 ${n} 格` })),
      { racer: r.id },
      true,
    );
  }
  if (p === 'party-animal') {
    const targets = g
      .active()
      .filter((o) => o.id !== r.id && o.position !== r.position)
      .map((o) => ({ racer: o.id, distance: Math.sign(r.position - o.position) }));
    if (targets.length) effect(g, r, p, [{ kind: 'base-group', targets }]);
  }
  if (p === 'genius')
    g.ask(
      r,
      'base-genius',
      'Genius：可預測主移動骰值',
      [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) })),
      { racer: r.id },
      true,
    );
  if (p === 'mastermind' && !r.predictionMade)
    g.ask(r, 'base-mastermind', 'Mastermind：預測本場冠軍', g.options(g.active()), { racer: r.id });
}
function reviewRoll(g) {
  const c = g.state.context,
    r = g.racer(c.actor);
  if (g.has(r, 'magician') && (c.magicianRerolls || 0) < 2 && !c.magicianDeclined) {
    g.ask(
      r,
      'base-reroll',
      'Magician：可重擲主移動骰',
      [{ value: 'yes', label: `重擲（已用 ${c.magicianRerolls || 0}／2）` }],
      { racer: r.id, power: 'magician' },
      true,
    );
    return true;
  }
  if (g.active().some((o) => g.has(o, 'dicemonger')) && !c.dealerUsed && !c.dealerDeclined) {
    g.ask(
      r,
      'base-reroll',
      'Dicemonger：可額外重擲一次',
      [{ value: 'yes', label: '重擲主移動骰' }],
      { racer: r.id, power: 'dicemonger' },
      true,
    );
    return true;
  }
  return false;
}
function mainResult(g) {
  const s = g.state,
    c = s.context,
    r = g.racer(c.actor),
    value = c.dice[0];
  if (c.bust || c.baseProcessed) return false;
  if (g.has(r, 'alchemist') && (value === 1 || value === 2) && !c.alchemistDecided) {
    g.ask(
      r,
      'base-alchemist',
      'Alchemist：可改為四格',
      [{ value: 'yes', label: '改為四格' }],
      { racer: r.id },
      true,
    );
    return true;
  }
  if (g.has(r, 'rocket-scientist') && !c.rocketDecided) {
    g.ask(
      r,
      'base-rocket',
      'Rocket Scientist：可加倍骰值並絆倒',
      [{ value: 'yes', label: '加倍並絆倒' }],
      { racer: r.id },
      true,
    );
    return true;
  }
  c.baseProcessed = true;
  const ops = [];
  if (c.prediction === value) {
    c.extra = true;
    ops.push({ kind: 'base-effect', racer: r.id, power: 'genius', ops: [] });
  }
  if (value === 1) {
    const skippers = g.order().filter((o) => g.has(o, 'skipper'));
    if (skippers.length) {
      s.skipperNext = skippers.at(-1).id;
      ops.push({ kind: 'base-effect', racer: skippers.at(-1).id, power: 'skipper', ops: [] });
    }
    const worms = g.order().filter((o) => o.id !== r.id && g.has(o, 'inchworm'));
    if (worms.length) {
      c.bust = true;
      for (const worm of worms) ops.push({ kind: 'base-wriggle', racer: worm.id });
    }
  }
  if (value === 6)
    for (const lackey of g.order().filter((o) => o.id !== r.id && g.has(o, 'lackey')))
      ops.push({ kind: 'base-effect', racer: lackey.id, power: 'lackey', ops: [move(lackey, 2)] });
  if (g.has(r, 'sisyphus') && value === 6) {
    c.bust = true;
    g.score(r, -Math.min(1, s.scores[r.playerId]));
    ops.push({
      kind: 'base-effect',
      racer: r.id,
      power: 'sisyphus',
      ops: [{ kind: 'warp', targets: { [r.id]: 0 } }],
    });
  }
  if (ops.length) {
    g.enqueue(...ops, { kind: 'main-result' });
    return true;
  }
  return false;
}
function modifier(g, r, amount) {
  let distance = amount;
  const c = g.state.context;
  if (g.has(r, 'blimp') && c.actor === r.id) {
    distance += c.blimpBonus ?? (r.position < 15 ? 3 : -1);
    effect(g, r, 'blimp');
  }
  if (g.has(r, 'hare')) {
    distance += 2;
    effect(g, r, 'hare');
  }
  if (g.has(r, 'party-animal')) {
    const bonus = g.active().filter((o) => o.id !== r.id && o.position === r.position).length;
    distance += bonus;
    if (bonus) effect(g, r, 'party-animal');
  }
  for (const source of g.order()) {
    if (source.id !== r.id && g.has(source, 'gunk')) {
      distance--;
      effect(g, source, 'gunk');
    }
    if (source.position === r.position && g.has(source, 'coach')) {
      distance++;
      effect(g, source, 'coach');
    }
  }
  return distance;
}
function plan(g, r, distance, meta) {
  let to = Math.max(0, r.position + distance);
  if (g.has(r, 'leaptoad') && !meta.follow) {
    let at = r.position,
      left = Math.abs(distance),
      step = Math.sign(distance),
      budget = 0;
    while (left && budget++ < 256) {
      at = Math.max(0, Math.min(30, at + step));
      if (at === 0 || at === 30 || !g.active().some((o) => o.id !== r.id && o.position === at))
        left--;
      else effect(g, r, 'leaptoad');
      if (at === 30) {
        at += left;
        break;
      }
      if (at === 0) break;
    }
    to = at;
  }
  if (to > 30 && g.active().some((o) => o.id !== r.id && g.has(o, 'stickler'))) {
    for (const stickler of g.order().filter((o) => o.id !== r.id && g.has(o, 'stickler')))
      effect(g, stickler, 'stickler');
    return { blocked: true, to: r.position };
  }
  return { to: Math.min(30, to) };
}
function beforeMove(g, r, distance, meta) {
  if (meta.basePrepared || meta.simultaneous || meta.follow) return false;
  const followers = g
    .order()
    .filter(
      (o) =>
        o.id !== r.id &&
        o.position === r.position &&
        g.has(o, 'suckerfish') &&
        !(meta.followOffered || []).includes(o.id),
    );
  if (followers.length) {
    const follower = followers[0];
    g.ask(
      follower,
      'base-follow',
      'Suckerfish：是否跟隨這次完整移動？',
      [{ value: 'yes', label: '跟隨' }],
      { racer: follower.id, source: r.id, distance, moveMeta: meta },
      true,
    );
    return true;
  }
  return false;
}
function afterMove(g, r, passed, meta, from, to, effects, phase) {
  if (phase === 'passes')
    for (const other of passed) {
      if (g.has(other, 'banana'))
        effects.push({
          kind: 'base-effect',
          racer: other.id,
          power: 'banana',
          ops: [{ kind: 'trip', racer: r.id }],
        });
      if (g.has(r, 'centaur'))
        effects.push({
          kind: 'base-effect',
          racer: r.id,
          power: 'centaur',
          ops: [move(other, -2)],
        });
    }
  if (phase === 'followers')
    for (const id of meta.followers || []) {
      const follower = g.racer(id);
      if (live(follower))
        effects.push({
          kind: 'base-effect',
          racer: id,
          power: 'suckerfish',
          ops: [move(follower, to - from, { follow: true, simultaneous: true })],
        });
    }
}
function arrive(g, r, op) {
  const s = g.state,
    others = g.active().filter((o) => o.id !== r.id && o.position === r.position);
  if (r.position !== 0) {
    const baby = others.find((o) => g.has(o, 'huge-baby'));
    if (baby) {
      effect(g, baby, 'huge-baby', [
        { kind: 'base-displace', racer: r.id, position: r.position - 1 },
      ]);
      return true;
    }
    if (g.has(r, 'huge-baby') && others.length) {
      effect(
        g,
        r,
        'huge-baby',
        others.flatMap((o) => [
          { kind: 'base-displace', racer: o.id, position: r.position - 1 },
          ...(g.has(o, 'banana') ? [{ kind: 'trip', racer: r.id }] : []),
        ]),
      );
      return true;
    }
  }
  if (op.simultaneous) return false;
  const ops = [];
  if (g.has(r, 'baba-yaga'))
    for (const o of others)
      ops.push({
        kind: 'base-effect',
        racer: r.id,
        power: 'baba-yaga',
        ops: [{ kind: 'trip', racer: o.id }],
      });
  for (const o of others.filter((o) => g.has(o, 'baba-yaga')))
    ops.push({
      kind: 'base-effect',
      racer: o.id,
      power: 'baba-yaga',
      ops: [{ kind: 'trip', racer: r.id }],
    });
  if (others.length === 1) {
    if (g.has(r, 'mouth'))
      ops.push({
        kind: 'base-effect',
        racer: r.id,
        power: 'mouth',
        ops: [{ kind: 'base-eliminate', racer: others[0].id }],
      });
    for (const romantic of g.order().filter((o) => g.has(o, 'romantic')))
      ops.push({
        kind: 'base-effect',
        racer: romantic.id,
        power: 'romantic',
        ops: [move(romantic, 2)],
      });
  }
  for (const duelist of [r, ...others].filter((o) => g.has(o, 'duelist')))
    for (const opponent of [r, ...others].filter((o) => o.id !== duelist.id))
      ops.push({ kind: 'base-duel-offer', racer: duelist.id, opponent: opponent.id });
  g.enqueue(...ops);
  return false;
}
function endRacer(g, r) {
  if (Math.abs(r.position - g.state.context.startPosition) <= 1)
    for (const heckler of g.order().filter((o) => g.has(o, 'heckler')))
      effect(g, heckler, 'heckler', [move(heckler, 2)]);
}
function finish(g, winner, candidates) {
  const s = g.state;
  if (s.finished.length !== 1) return;
  const mastermind = candidates.find((o) => o.predictedWinner === winner.id && !o.eliminated);
  if (mastermind) {
    mastermind.finished = true;
    s.finished.push(mastermind.id);
    g.emit('power', 'Mastermind 預測正確，取得亞軍', { racer: mastermind.id });
  }
}
function choose(g, p, value) {
  if (!p.kind.startsWith('base-')) return false;
  const s = g.state,
    c = s.context,
    r = g.racer(p.racer);
  if (p.kind === 'base-copy') r.copyTarget = value;
  if (p.kind === 'base-egg' || p.kind === 'base-twin') {
    if (value !== 'skip') {
      r.copiedPowers.push(value);
      g.enqueue({ kind: 'setup', racer: r.id });
    }
  }
  if (p.kind === 'base-mastermind') {
    r.predictionMade = true;
    r.predictedWinner = value;
  }
  if (p.kind === 'base-genius' && value !== 'skip') c.prediction = Number(value);
  if (p.kind === 'base-cheer' && value !== 'skip')
    effect(g, r, 'cheerleader', [
      { kind: 'base-group', targets: g.extreme(true).map((o) => ({ racer: o.id, distance: 2 })) },
      move(r, 1),
    ]);
  if (p.kind === 'base-hypnotist' && value !== 'skip')
    effect(g, r, 'hypnotist', [{ kind: 'warp', targets: { [value]: r.position } }]);
  if (p.kind === 'base-third' && value !== 'skip')
    effect(g, r, 'third-wheel', [{ kind: 'warp', targets: { [r.id]: Number(value) } }]);
  if (p.kind === 'base-alchemist') {
    c.alchemistDecided = true;
    if (value !== 'skip') {
      c.total = 4;
      c.baseTotal = 4;
      g.enqueue(
        { kind: 'base-effect', racer: r.id, power: 'alchemist', ops: [] },
        { kind: 'main-result' },
      );
    } else g.enqueue({ kind: 'main-result' });
  }
  if (p.kind === 'base-rocket') {
    c.rocketDecided = true;
    if (value !== 'skip') {
      c.baseTotal = (c.baseTotal ?? c.total) * 2;
      g.enqueue(
        {
          kind: 'base-effect',
          racer: r.id,
          power: 'rocket-scientist',
          ops: [{ kind: 'trip', racer: r.id }],
        },
        { kind: 'main-result' },
      );
    } else g.enqueue({ kind: 'main-result' });
  }
  if (p.kind === 'base-reroll') {
    if (value === 'skip') {
      if (p.power === 'magician') c.magicianDeclined = true;
      else c.dealerDeclined = true;
      g.enqueue({ kind: 'roll-review' });
    } else {
      const ops = [];
      if (p.power === 'magician') {
        c.magicianRerolls = (c.magicianRerolls || 0) + 1;
        ops.push({ kind: 'base-effect', racer: r.id, power: 'magician', ops: [] });
      } else {
        c.dealerUsed = true;
        for (const dealer of g.order().filter((o) => o.id !== r.id && g.has(o, 'dicemonger')))
          ops.push({
            kind: 'base-effect',
            racer: dealer.id,
            power: 'dicemonger',
            ops: [move(dealer, 1)],
          });
      }
      c.nemeses = [];
      g.beginRoll(r);
      g.enqueue(...ops);
    }
  }
  if (p.kind === 'base-follow') {
    const meta = {
      ...p.moveMeta,
      followOffered: [...(p.moveMeta.followOffered || []), r.id],
      followers: [...(p.moveMeta.followers || []), ...(value === 'skip' ? [] : [r.id])],
    };
    g.enqueue(move(g.racer(p.source), p.distance, meta));
  }
  if (p.kind === 'base-flip') {
    if (value !== 'skip')
      effect(g, r, 'flip-flop', [
        { kind: 'warp', targets: { [r.id]: g.racer(value).position, [value]: r.position } },
      ]);
    else g.beginRoll(r);
  }
  if (p.kind === 'base-duel' && value !== 'skip')
    g.enqueue({
      kind: 'die',
      racer: r.id,
      purpose: 'base-duel',
      duel: { owner: r.id, opponent: p.opponent },
      side: 'a',
    });
  return true;
}
function run(g, op) {
  if (!op.kind.startsWith('base-')) return false;
  const s = g.state,
    r = g.racer(op.racer);
  if (op.kind === 'base-end' && r) endRacer(g, r);
  if (op.kind === 'base-effect' && live(r) && g.has(r, op.power)) {
    // Following a Scoocher for another finite step is explicitly not an
    // infinite loop (English rulebook p.23). Two Scoochers alone still stop
    // after one cycle; actual following opens a new movement chain.
    if (op.power === 'suckerfish') g.baseCause = [];
    const key = `${r.id}:${op.power}`;
    if ((g.baseCause || []).includes(key)) {
      g.emit('loop', names[r.racerId] + ' 能力循環完成一次後停止', { racer: r.id });
      return true;
    }
    g.baseCause = [...(g.baseCause || []), key];
    g.emit('power', names[r.racerId] + ' 使用 ' + names[op.power], { racer: r.id });
    g.enqueue(...op.ops, ...reactions(g, r, op.power));
  }
  if (op.kind === 'base-group') {
    const tail = s.queue,
      effects = [];
    for (const target of op.targets) {
      const racer = g.racer(target.racer);
      if (!live(racer)) continue;
      s.queue = [];
      g.move(racer, target.distance, { simultaneous: true });
      effects.push(...s.queue);
    }
    s.queue = [...effects, ...tail];
  }
  if (op.kind === 'base-displace' && live(r)) {
    r.position = Math.max(0, op.position);
    g.emit('displace', names[r.racerId] + ' 被擠到後一格', { racer: r.id });
    g.enqueue({ kind: 'arrive', racer: r.id });
  }
  if (op.kind === 'base-eliminate' && live(r)) g.eliminate(r);
  if (op.kind === 'base-fixed-main' && live(r)) g.performMain(r, op.amount);
  if (op.kind === 'base-wriggle' && live(r) && g.has(r, 'inchworm')) {
    const before = s.queue.length;
    const amount = modifier(g, r, 1);
    const modifiers = s.queue.splice(0, s.queue.length - before);
    effect(g, r, 'inchworm', [...modifiers, move(r, amount, { main: true })]);
  }
  if (op.kind === 'base-duel-offer' && live(r) && g.has(r, 'duelist')) {
    const other = g.racer(op.opponent),
      key = `duel:${r.id}:${op.opponent}:${r.position}`;
    if (
      live(other) &&
      other.position === r.position &&
      !s.seen.includes(key) &&
      !(g.baseCause || []).includes(`${r.id}:duelist`)
    ) {
      s.seen.push(key);
      g.ask(
        r,
        'base-duel',
        'Duelist：是否與同格角色決鬥？',
        [{ value: 'yes', label: '決鬥' }],
        { racer: r.id, opponent: other.id },
        true,
      );
    }
  }
  return true;
}
function dieResult(g, op) {
  if (op.purpose !== 'base-duel') return false;
  if (!op.value) return true;
  if (op.side === 'a')
    g.enqueue({
      kind: 'die',
      racer: op.duel.opponent,
      purpose: 'base-duel',
      side: 'b',
      duel: { ...op.duel, a: op.value },
    });
  else {
    const owner = g.racer(op.duel.owner),
      winner = g.racer(op.duel.a >= op.value ? op.duel.owner : op.duel.opponent);
    if (live(owner) && live(winner)) effect(g, owner, 'duelist', [move(winner, 2)]);
  }
  return true;
}
function observe(g, r, power, action, continuation = false) {
  if (!r || baseIds.has(power) || !g.active().some((o) => o.id !== r.id && g.has(o, 'scoocher')))
    return action();
  const cause = g.baseCause || [],
    key = `${r.id}:${power}`;
  if (!continuation && cause.includes(key)) {
    g.emit('loop', '能力循環完成一次後停止', { racer: r.id });
    return;
  }
  const before = JSON.stringify([g.state.racers, g.state.scores, g.state.context]),
    queued = g.state.queue.length;
  g.baseCause = cause.includes(key) ? cause : [...cause, key];
  action();
  if (g.state.pending && !g.state.pending.powerOrigin)
    g.state.pending.powerOrigin = { racer: r.id, power };
  const added = g.state.queue.length - queued;
  if (
    g.state.phase === 'racing' &&
    (added > 0 || before !== JSON.stringify([g.state.racers, g.state.scores, g.state.context]))
  )
    g.state.queue.splice(Math.max(0, added), 0, ...reactions(g, r, power));
  g.baseCause = cause;
}
function notify(g, r, power) {
  g.enqueue(...reactions(g, r, power));
}
module.exports = {
  observe,
  notify,
  baseIds,
  prepare,
  setup,
  startPower,
  reviewRoll,
  mainResult,
  modifier,
  plan,
  beforeMove,
  afterMove,
  arrive,
  endRacer,
  finish,
  choose,
  run,
  dieResult,
  effect,
  reactions,
};
