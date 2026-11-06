const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('../../tests/helpers/browser-modules.cjs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/composables/drawing-party-sounds.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const exportsUnderTest = {};
vm.runInNewContext(compiled, fs.withEngineImports({ exports: exportsUnderTest, require }));
const { drawingPartyCue } = exportsUnderTest;

test('Minimal cues distinguish submissions, the guesser turn and personal correct results', () => {
  const drawing = {
    type: 'minimal',
    phase: 'drawing',
    roundId: 'round',
    me: 'artist',
    guesserId: 'guesser',
    submitted: false,
    attempts: [],
  };
  assert.equal(drawingPartyCue({ ...drawing, submitted: true }, drawing).cue, 'confirm');
  assert.equal(drawingPartyCue({ ...drawing, myShapes: [{}] }, drawing), undefined);
  const guessing = { ...drawing, phase: 'guessing', me: 'guesser' };
  assert.equal(drawingPartyCue(guessing, { ...drawing, me: 'guesser' }).cue, 'turn');
  const finished = {
    ...guessing,
    phase: 'finished',
    attempts: [{ artistId: 'artist', correct: true }],
  };
  assert.equal(drawingPartyCue(finished, guessing).cue, 'correct');
  assert.equal(drawingPartyCue({ ...finished, me: 'other' }, guessing).cue, 'reveal');
  assert.equal(drawingPartyCue(finished, finished), undefined);
  assert.equal(drawingPartyCue({ ...finished, interrupted: true }, guessing), undefined);
});

test('Telephone cues prioritize the next task, and reveal only newly exposed pages', () => {
  const passing = {
    type: 'telephone',
    phase: 'passing',
    stepId: 'one',
    task: { submitted: false },
  };
  const submitted = { ...passing, task: { submitted: true } };
  assert.equal(drawingPartyCue(submitted, passing).cue, 'confirm');
  assert.equal(drawingPartyCue(submitted, submitted), undefined);
  assert.equal(drawingPartyCue({ ...passing, stepId: 'two' }, submitted).cue, 'turn');
  const finished = { ...passing, phase: 'finished', task: null, review: { index: -1 } };
  assert.equal(drawingPartyCue(finished, submitted).cue, 'reveal');
  assert.equal(drawingPartyCue({ ...finished, interrupted: true }, submitted), undefined);
  const page = { ...finished, review: { index: 0 } };
  assert.equal(drawingPartyCue(page, finished).key, 'telephone:page:one:0');
  assert.equal(drawingPartyCue(page, page), undefined);
});
