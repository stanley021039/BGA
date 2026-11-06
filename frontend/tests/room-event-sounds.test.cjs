const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('../../tests/helpers/browser-modules.cjs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { computed, effectScope, reactive, ref } = require('vue');

const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/composables/room-event-sounds.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function load(window = {}) {
  const exports = {};
  vm.runInNewContext(compiled, fs.withEngineImports({ exports, require, window }));
  return exports;
}
const { bluffCues, giftDeliveryCue, majorityCues, pokerCues, trpgCues } = load();
const player = { id: 'me', folded: false, stack: 30 };
const poker = {
  hand: 1,
  phase: 'preflop',
  board: [],
  players: [player, { id: 'peer' }],
  turn: 1,
  me: 'me',
  deadline: 200,
  serverNow: 100,
};
const names = (cues) => (cues ? [cues.cue] : []);

test('Poker cues reflect public card batches and actionable local turns', () => {
  const flop = { ...poker, phase: 'flop', board: [1, 2, 3], turn: 0 };
  assert.deepEqual(names(pokerCues(flop, poker)), ['turn']);
  assert.deepEqual(names(pokerCues(flop, flop)), []);
  assert.deepEqual(names(pokerCues({ ...flop, deadline: 240 }, flop)), ['turn']);
  assert.deepEqual(names(pokerCues({ ...flop, serverNow: 200 }, poker)), ['card-draw']);
  const showdown = { ...flop, phase: 'showdown', board: [1, 2, 3, 4, 5] };
  assert.deepEqual(names(pokerCues(showdown, flop)), ['reveal']);
  assert.deepEqual(names(pokerCues(showdown, showdown)), []);
});

test('TRPG only cues a newly published result for the current scene', () => {
  const planning = { phase: 'planning', sceneId: 'a', results: [] };
  const reveal = { ...planning, phase: 'reveal', results: [{ sceneId: 'a' }] };
  assert.deepEqual(names(trpgCues(reveal, planning)), ['settlement']);
  assert.deepEqual(names(trpgCues(reveal, reveal)), []);
  assert.deepEqual(names(trpgCues({ ...reveal, phase: 'finished' }, reveal)), []);
});

test('Poker immediately plays the local turn cue when the board changes', () => {
  const played = [];
  const owner = {
    disconnect() {},
    destroy() {},
    update: () => true,
    play: (cue) => played.push(cue),
  };
  const { useRoomEventSounds } = load({ GameSounds: { create: () => owner } });
  const room = reactive({ connected: true, scope: 1 });
  const snapshot = ref(poker);
  const scope = effectScope();
  scope.run(() =>
    useRoomEventSounds(
      room,
      computed(() => snapshot.value),
      pokerCues,
    ),
  );
  snapshot.value = { ...poker, phase: 'flop', board: [1, 2, 3], turn: 0 };
  assert.deepEqual(played, ['turn']);
  scope.stop();
});

test('Gift arrival cues play on each new match in the same room', () => {
  const played = [];
  const window = { AudioSettings: { playEffect: (cue) => played.push(cue) } };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../../public/shared/game-sounds.js'), 'utf8'),
    { window },
  );
  const owner = window.GameSounds.create();
  for (const version of [1, 9]) {
    const choosing = { code: 'ABC123', round: 1, version, me: 'me', delivery: null };
    const delivering = {
      ...choosing,
      version: version + 1,
      delivery: { index: 0, recipientId: 'me' },
    };
    owner.update(choosing);
    assert.equal(owner.update(delivering), true);
    const arrival = giftDeliveryCue(delivering, choosing);
    owner.play(arrival.cue, arrival.key);
    assert.equal(giftDeliveryCue(delivering, delivering), undefined);
  }
  assert.deepEqual(played, ['turn', 'turn']);
});

test('Bluff reveals once and confirms only the local player’s newly accepted ban vote', () => {
  const discussion = { phase: 'discussion', roundId: 'round', results: [] };
  const result = { resultId: 'result', ban: { voted: false, votes: 0 } };
  const reveal = { ...discussion, phase: 'reveal', results: [result] };
  assert.deepEqual(names(bluffCues(reveal, discussion)), ['reveal']);
  assert.deepEqual(names(bluffCues(reveal, reveal)), []);
  const peerVote = { ...reveal, results: [{ ...result, ban: { voted: false, votes: 1 } }] };
  assert.deepEqual(names(bluffCues(peerVote, reveal)), []);
  const ownVote = { ...reveal, results: [{ ...result, ban: { voted: true, votes: 2 } }] };
  assert.deepEqual(names(bluffCues(ownVote, peerVote)), ['confirm']);
  assert.deepEqual(names(bluffCues(ownVote, ownVote)), []);
});

test('Majority signals aggregation once and leaves scoring to the result player', () => {
  const answering = { phase: 'answering', round: 2, version: 4 };
  const review = { ...answering, phase: 'review', version: 5 };
  assert.deepEqual(names(majorityCues(review, answering)), ['card-draw']);
  assert.deepEqual(names(majorityCues({ ...review, version: 6 }, review)), []);
  assert.deepEqual(names(majorityCues({ ...review, phase: 'reveal' }, review)), []);
});
