'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createRoomTransitions } = require('../src/rooms/transitions');
const { actionFeedback, recordActionFeedback } = require('../src/rooms/action-feedback');
const make = () => ({
  type: 'bluff',
  round: 1,
  players: [
    { id: 'a', name: '同名' },
    { id: 'b', name: '同名' },
  ],
});
test('only successful public action categories are recorded; private targets and inputs are absent', () => {
  const r = make(),
    t = createRoomTransitions({});
  t.transact(
    r,
    {
      actor: 'a',
      action: 'action',
      input: { action: 'guess', targetId: 'b', text: '秘密答案', requestId: 'one' },
    },
    () => {},
  );
  const e = actionFeedback(r);
  assert.equal(e.length, 1);
  assert.equal(e[0].actor.id, 'a');
  assert.equal(e[0].action, '送出猜測');
  assert.equal(e[0].target, undefined);
  assert.ok(!JSON.stringify(e).includes('秘密答案'));
  assert.ok(!JSON.stringify(e).includes('targetId'));
  assert.throws(() =>
    t.transact(r, { actor: 'b', action: 'answer' }, () => {
      throw Error('rejected');
    }),
  );
  assert.equal(actionFeedback(r).length, 1);
  t.transact(r, { actor: 'b', action: 'draft', input: { text: '秘密草稿' } }, () => {});
  assert.equal(actionFeedback(r).length, 1); // Private drafts are not public action feedback.
  assert.ok(!JSON.stringify(actionFeedback(r)).includes('秘密草稿'));
});
test('private drawing drafts and unknown actions are not announcements; receipt replay is deduplicated per round', () => {
  const r = make();
  for (const action of ['draw-stroke', 'card-frame', 'unknown', 'heartbeat'])
    recordActionFeedback(r, { actor: 'a', action });
  assert.deepEqual(actionFeedback(r), []);
  const operation = { actor: 'a', action: 'answer', input: { requestId: 'same' } };
  recordActionFeedback(r, operation);
  recordActionFeedback(r, operation);
  assert.equal(actionFeedback(r).length, 1);
  r.round++;
  recordActionFeedback(r, operation);
  assert.equal(actionFeedback(r).length, 2);
  recordActionFeedback(r, { actor: 'b', action: 'answer', input: { requestId: 'same' } });
  assert.equal(actionFeedback(r).length, 3);
  assert.notEqual(actionFeedback(r)[1].actor.id, actionFeedback(r)[2].actor.id);
});
test('public shot target is resolved to its owner; quacks purchase keeps image-ready public data', () => {
  const r = make();
  r.type = 'thunder';
  r.cars = [{ id: 'car', owner: 'b' }];
  recordActionFeedback(r, { actor: 'a', action: 'shoot', input: { target: 'car' } });
  assert.deepEqual(actionFeedback(r)[0].target, { id: 'b', name: '同名' });
  r.type = 'quacks';
  recordActionFeedback(r, {
    actor: 'a',
    action: 'action',
    input: { action: 'buy', color: 'red', value: 2, privateBag: 'not public' },
  });
  assert.deepEqual(actionFeedback(r)[1].item, { color: 'red', value: 2 });
  assert.ok(!JSON.stringify(actionFeedback(r)).includes('privateBag'));
});
test('feedback storage is bounded, copied, and isolated between room instances', () => {
  const r = make();
  for (let i = 0; i < 40; i++) recordActionFeedback(r, { actor: 'a', action: 'check' }, i);
  const events = actionFeedback(r);
  assert.equal(events.length, 20);
  assert.equal(events[0].at, 20);
  events[0].actor.name = 'changed';
  assert.equal(actionFeedback(r)[0].actor.name, '同名');
  assert.deepEqual(actionFeedback(make()), []);
});
