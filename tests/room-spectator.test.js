'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spectatorView, observerAudioContext, games } = require('../src/rooms/spectator');
const classes = {
  poker: require('../src/games/poker').Room,
  thunder: require('../src/games/thunder').ThunderRoom,
  majority: require('../src/games/majority').MajorityRoom,
  gift: require('../src/games/gift').GiftRoom,
  draw: require('../src/games/draw-guess').DrawGuessRoom,
  trpg: require('../src/games/trpg').TrpgRoom,
  telephone: require('../src/games/telephone').TelephoneRoom,
  musicquiz: require('../src/games/musicquiz').MusicQuizRoom,
  minimal: require('../src/games/minimal').MinimalRoom,
  bluff: require('../src/games/bluff').BluffRoom,
  quacks: require('../src/games/quacks').QuacksRoom,
  ceo: require('../src/games/ceo-room').CeoRoom,
  'second-wind': require('../src/games/second-wind/room').SecondWindRoom,
  lounge: require('../src/games/lounge').LoungeRoom,
};
const SECRET = 'PRIVATE-CANARY-296';
function make(type, start = false) {
  const room = new classes[type]('ABCDEF', type);
  for (let i = 0; i < 3; i++) room.add('玩家' + i, true);
  if (start) room.start();
  return room;
}
const hidden = (room, message = '') =>
  assert.equal(JSON.stringify(spectatorView(room)).includes(SECRET), false, message);

test('all room types have detached public projections without calling a seated view or changing membership', async (t) => {
  assert.deepEqual(Object.keys(classes), Object.keys(games));
  for (const type of Object.keys(classes))
    await t.test(type, () => {
      const room = make(type);
      room.unpublished = SECRET;
      for (const p of room.players) p.privateNote = SECRET;
      room.view = () => {
        throw Error('observer must not borrow a player view');
      };
      for (const started of [false, true]) {
        if (started && type === 'lounge') continue;
        if (started) room.start();
        const before = JSON.stringify(room),
          state = spectatorView(room),
          serialized = JSON.stringify(state);
        assert.equal(state.schema, 1);
        assert.equal(state.spectator, true);
        assert.equal(state.type, type);
        assert.equal(state.players.length, 3);
        assert.ok(state.players.every((p) => p.id.startsWith('observer-')));
        assert.equal(serialized.includes(SECRET), false);
        for (const p of room.players) {
          assert.equal(serialized.includes(p.secret), false);
          assert.equal(
            serialized.includes(p.id),
            false,
            'public player references use public identifiers or names',
          );
        }
        assert.equal(JSON.stringify(room), before);
        state.players[0].name = 'changed public copy';
        assert.equal(room.players[0].name, '玩家0');
      }
    });
});

test('poker hole cards stay hidden until a contested showdown; folded and uncontested hands stay hidden', () => {
  const r = make('poker', true);
  const holes = r.players.map((p) => p.cards.slice());
  assert.ok(spectatorView(r).players.every((p) => p.cards.every((c) => c === null)));
  r.phase = 'showdown';
  r.players[0].folded = true;
  let v = spectatorView(r);
  assert.deepEqual(v.players[0].cards, [null, null]);
  assert.deepEqual(v.players[1].cards, holes[1]);
  r.players[1].folded = true;
  v = spectatorView(r);
  assert.deepEqual(v.players[2].cards, [null, null]);
});

test('draw includes accepted timed strokes but hides candidates, current answer and correct guess text', () => {
  const r = make('draw', true);
  r.phase = 'drawing';
  r.question = { title: SECRET, category: '公開類別' };
  r.candidates = [{ title: SECRET }];
  r.guesses = [{ name: '玩家1', correct: true, text: SECRET, points: 3 }];
  r.canvas.strokes = [
    {
      tool: 'brush',
      color: '#123456',
      size: 4,
      strokeId: 'public-stroke',
      version: 1,
      points: [
        [1, 1],
        [3, 4],
      ],
      pointTimes: [0, 200],
      privateMetadata: SECRET,
    },
  ];
  hidden(r);
  const v = spectatorView(r);
  assert.deepEqual(v.drawing.strokes[0].pointTimes, [0, 200]);
  assert.equal(v.drawing.strokes[0].privateMetadata, undefined);
  r.phase = 'reveal';
  r.result = { canvasEpoch: r.canvas.epoch, title: SECRET };
  assert.equal(JSON.stringify(spectatorView(r)).includes(SECRET), true);
});

test('draw observation keeps the real choosing, drawing and reveal countdown durations', () => {
  const room = make('draw', true);
  assert.equal(spectatorView(room).duration, 15000);
  room.choose(room.presenterId, room.candidates[0].id);
  assert.equal(spectatorView(room).duration, room.options.seconds * 1000);
  room.act(room.presenterId, 'skip', { round: room.round, canvasEpoch: room.canvas.epoch });
  assert.equal(room.phase, 'reveal');
  assert.equal(spectatorView(room).duration, 8000);
});

test('majority votes, gift assignments, minimal drafts, bluff roles and trpg plans remain private before reveal', () => {
  const majority = make('majority', true);
  majority.phase = 'answering';
  majority.answers = { [majority.players[0].id]: SECRET };
  majority.question = { prompt: '公開問題', options: ['A', 'B'] };
  hidden(majority);
  majority.phase = 'review';
  majority.groups = [{ label: SECRET, count: 1, playerIds: [majority.players[0].id] }];
  assert.ok(JSON.stringify(spectatorView(majority)).includes(SECRET));
  const gift = make('gift', true);
  gift.phase = 'choosing';
  gift.assignments = { [gift.players[0].id]: SECRET };
  gift.rankings = { [gift.players[0].id]: SECRET };
  hidden(gift);
  const minimal = make('minimal', true);
  minimal.question.title = SECRET;
  minimal.drafts[minimal.players[1].id] = [{ kind: 'line', x1: 1, y1: 2, x2: 3, y2: 4 }];
  assert.deepEqual(spectatorView(minimal).drawings, []);
  hidden(minimal);
  minimal.phase = 'guessing';
  minimal.order = [minimal.players[1].id];
  minimal.shown = 0;
  hidden(minimal);
  assert.equal(spectatorView(minimal).drawings.length, 1);
  const bluff = make('bluff', true);
  bluff.phase = 'preparing';
  bluff.question = { title: '公開題目', answer: SECRET, explanation: SECRET };
  bluff.roles = { [bluff.players[1].id]: SECRET };
  bluff.draft = { honestId: SECRET };
  hidden(bluff);
  const trpg = make('trpg', true);
  trpg.plans = { [trpg.players[0].id]: { note: SECRET, stance: SECRET } };
  hidden(trpg);
});

test('musicquiz masks song identity/year and private guesses while keeping public playback and timeline', () => {
  const r = make('musicquiz', true);
  r.phase = 'intro';
  r.current = {
    title: SECRET,
    artist: SECRET,
    year: 2345,
    videoId: 'dQw4w9WgXcQ',
    introStart: 1,
    highlightStart: 30,
  };
  r.answers = { [r.players[0].id]: { text: SECRET } };
  r.introChoices = [{ title: '公開選項' }];
  hidden(r);
  let v = spectatorView(r);
  assert.equal(v.clips[0].playback.stage, 'intro');
  assert.equal(JSON.stringify(v).includes('2345'), false);
  r.phase = 'reveal';
  assert.ok(JSON.stringify(spectatorView(r)).includes(SECRET));
  r.phase = 'pick';
  assert.deepEqual(observerAudioContext(r), {});
});

test('quacks honors hidden-progress and never exposes bag order, peek or private choices', () => {
  const r = make('quacks', true),
    p = r.players[0];
  r.phase = 'brewing';
  r.options.hiddenProgress = true;
  p.pot = [{ color: SECRET, value: 2, position: 3 }];
  p.bag = [{ color: SECRET, value: 4 }];
  p.bagPeek = [SECRET];
  p.pending = [{ title: SECRET }];
  p.exploded = false;
  p.stopped = false;
  let v = spectatorView(r);
  assert.equal(v.pots[0].hidden, true);
  assert.deepEqual(v.pots[0].chips, []);
  hidden(r);
  p.exploded = true;
  v = spectatorView(r);
  assert.equal(v.pots[0].hidden, false);
  assert.equal(v.pots[0].chips[0].color, SECRET);
  p.pot = [];
  r.phase = 'settlement';
  hidden(r, 'revealing the pot must not reveal the remaining bag or pending choices');
});

test('thunder masks hidden hazards and pending round dice, then shows only face-up information', () => {
  const r = make('thunder', true);
  r.tiles = [{ start: 0, cells: [[{ kind: '?', hazard: { face: false, kind: SECRET } }]] }];
  r.players[0].dice = [{ value: SECRET }];
  r.diceCheck = { kind: 'round', owner: r.players[0].id };
  hidden(r);
  assert.equal(spectatorView(r).track.cells[0].label, '?');
  r.players[0].dice = [];
  r.diceCheck = null;
  r.tiles[0].cells[0][0].hazard.face = true;
  assert.equal(spectatorView(r).track.cells[0].label, SECRET);
});

test('CEO and Second Wind expose neutral game projections and clear them on rematch', () => {
  const { returnToWaiting } = require('../src/rooms/rematch');
  for (const type of ['ceo', 'second-wind']) {
    const r = make(type, true),
      g = r.observerGame();
    assert.ok(g);
    if (type === 'ceo') assert.ok(g.groups.every((group) => group.adjustments === null));
    else assert.equal(g.ownSelection, null);
    r.phase = 'finished';
    returnToWaiting(r, r.host);
    assert.equal(r.phase, 'waiting');
    assert.equal(r.observerGame(), null);
    const v = spectatorView(r);
    assert.equal(v.track, null);
    assert.deepEqual(
      v.players.map((p) => p.lines),
      [[], [], []],
    );
  }
});
module.exports = { classes, make };
