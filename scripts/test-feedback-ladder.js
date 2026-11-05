// Tests de la machine à états P3 — lancer : node scripts/test-feedback-ladder.js
const assert = require('assert');
const FL = require('../feedback-ladder.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('✓', name); }
  catch (e) { console.error('✗', name, '\n ', e.message); process.exitCode = 1; }
}

const T1 = '-아/어도 될까요?';
const T2 = '여쭤보다';
const err = (target, extra = {}) => Object.assign({ status: 'minor', original: 'x', fixed: 'y', target }, extra);
const ok = (target) => ({ status: 'correct', original: 'y', fixed: 'y', target });

test('1ʳᵉ erreur sur une cible → relance, rien à enregistrer', () => {
  const l = FL.create({ targets: [T1, T2] });
  const d = l.process(err('여쭤보다'));
  assert.strictEqual(d.display, 'prompt');
  assert.strictEqual(d.target, T2);
  assert.strictEqual(d.save, false);
  assert.strictEqual(l.rungOf(T2), 1);
});

test('autocorrection après relance → self_repaired, échelon remis à 0', () => {
  const l = FL.create({ targets: [T2] });
  l.process(err(T2));
  const d = l.process(ok(T2));
  assert.strictEqual(d.display, 'self_repaired');
  assert.strictEqual(l.rungOf(T2), 0);
  assert.strictEqual(l.report().targets[0].selfRepaired, 1);
});

test('2ᵉ erreur sur la même cible → explicite + enregistrement + répétition attendue', () => {
  const l = FL.create({ targets: [T2] });
  l.process(err(T2));
  const d = l.process(err(T2, { fixed: '논문에 대해 여쭤보고 싶습니다' }));
  assert.strictEqual(d.display, 'explicit');
  assert.strictEqual(d.save, true);
  assert.strictEqual(l.rungOf(T2), 0);
  assert.ok(l.pendingRepeat);
});

test('erreurs sur deux cibles différentes → deux relances indépendantes', () => {
  const l = FL.create({ targets: [T1, T2] });
  assert.strictEqual(l.process(err(T1)).display, 'prompt');
  assert.strictEqual(l.process(err(T2)).display, 'prompt');
});

test('erreur hors cible → reformulation, pas d\'enregistrement', () => {
  const l = FL.create({ targets: [T1] });
  const d = l.process(err('NONE'));
  assert.strictEqual(d.display, 'recast');
  assert.strictEqual(d.save, false);
});

test('mode strict : erreur majeure hors cible → explicite', () => {
  const l = FL.create({ targets: [T1], mode: 'strict' });
  assert.strictEqual(l.process(err('NONE', { status: 'major' })).display, 'explicit');
  assert.strictEqual(l.process(err('NONE', { status: 'minor' })).display, 'recast');
});

test('mode discret : toujours reformulation', () => {
  const l = FL.create({ targets: [T1], mode: 'discret' });
  assert.strictEqual(l.process(err(T1)).display, 'recast');
  assert.strictEqual(l.process(err(T1)).display, 'recast');
});

test('confiance faible → « à vérifier », jamais enregistré, échelon inchangé', () => {
  const l = FL.create({ targets: [T1] });
  const d = l.process(err(T1, { confidence: 'low' }));
  assert.strictEqual(d.display, 'verify');
  assert.strictEqual(d.save, false);
  assert.strictEqual(l.rungOf(T1), 0);
});

test('transcription suspecte → stt, la tentative ne compte pas', () => {
  const l = FL.create({ targets: [T1] });
  const d = l.process(err(T1, { stt_suspect: 'yes' }));
  assert.strictEqual(d.display, 'stt');
  assert.strictEqual(l.rungOf(T1), 0);
});

test('undoLast après correction de transcription annule la relance', () => {
  const l = FL.create({ targets: [T1] });
  l.process(err(T1));
  l.undoLast();
  assert.strictEqual(l.rungOf(T1), 0);
  assert.strictEqual(l.process(err(T1)).display, 'prompt');
});

test('répétition : proche = ok ; 2 essais maximum, jamais bloquant', () => {
  const l = FL.create({ targets: [T2] });
  l.process(err(T2)); l.process(err(T2, { original: '논문에 대해 물어보고 싶어요', fixed: '논문에 대해 여쭤보고 싶습니다.' }));
  const r1 = l.checkRepeat('논문에 대해 물어보고 싶습니다');
  assert.strictEqual(r1.ok, false); assert.strictEqual(r1.done, false);
  const r2 = l.checkRepeat('논문에 대해 여쭤보고 싶습니다');
  assert.strictEqual(r2.ok, true); assert.strictEqual(r2.done, true);
  assert.strictEqual(l.pendingRepeat, null);
});

test('matchTarget tolère les variantes (tiret, espaces)', () => {
  assert.strictEqual(FL.matchTarget('아/어도 될까요', [T1]), T1);
  assert.strictEqual(FL.matchTarget('NONE', [T1]), null);
  assert.strictEqual(FL.matchTarget('-는 것으로 나타나다', ['-는 것으로 나타나다']), '-는 것으로 나타나다');
});

test('cibles limitées à 3', () => {
  const l = FL.create({ targets: ['a', 'b', 'c', 'd'] });
  assert.strictEqual(l.targets.length, 3);
});

test('promptState indique l\'échelon à Claude', () => {
  const l = FL.create({ targets: [T1] });
  assert.ok(/FEEDBACK: prompt/.test(l.promptState()));
  l.process(err(T1));
  assert.ok(/FEEDBACK: explicit/.test(l.promptState()));
});

console.log(`\n${passed} test(s) réussi(s)`);
