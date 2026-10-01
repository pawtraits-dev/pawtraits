/**
 * Quiz scoring tests. Run: npx tsx scripts/test-quiz-scoring.ts
 * Uses the real seed content (db/seeds/pawsonality-content.json) for both species.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import path from 'path';
import { lockedCode, otherPole, scoreQuiz, seededShuffle, validateAnswers, withPetName } from '../lib/quiz/scoring';
import { DIMENSIONS, DIMENSION_ORDER, type Answers, type QuizQuestion } from '../lib/quiz/types';
import { checkPublishable, type AdminQuestionRow, type AdminResultTypeRow } from '../lib/quiz/admin';
import { parseQuestionInput, parseResultTypeInput } from '../lib/quiz/admin-server';

const content = JSON.parse(readFileSync(path.resolve(__dirname, '../db/seeds/pawsonality-content.json'), 'utf8'));
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

/** Answers that produce a target code: every question swiped towards the target pole */
function answersFor(questions: QuizQuestion[], code: string): Answers {
  const a: Answers = {};
  for (const q of questions) {
    const target = code[DIMENSION_ORDER.indexOf(q.dimension)];
    a[q.id] = q.rightPole === target ? 'right' : 'left';
  }
  return a;
}
const allCodes = (): string[] => {
  const out: string[] = [];
  for (const e of DIMENSIONS.EI) for (const s of DIMENSIONS.SN) for (const t of DIMENSIONS.TF) for (const b of DIMENSIONS.BC) out.push(e + s + t + b);
  return out;
};

for (const quiz of content.quizzes) {
  console.log(`\n${quiz.title}`);
  const questions: QuizQuestion[] = quiz.questions.filter((q: any) => q.isActive).map((q: any) => ({ ...q, id: q.key }));

  test('20 active questions, 5 per dimension', () => {
    assert.equal(questions.length, 20);
    for (const d of DIMENSION_ORDER) assert.equal(questions.filter(q => q.dimension === d).length, 5);
  });

  test('every question scores a pole of its own dimension', () => {
    for (const q of questions) assert.ok((DIMENSIONS[q.dimension] as readonly string[]).includes(q.rightPole), q.id);
  });

  test('each dimension has right swipes for both poles (all-right does not decide the result)', () => {
    for (const d of DIMENSION_ORDER) assert.equal(new Set(questions.filter(q => q.dimension === d).map(q => q.rightPole)).size, 2, d);
  });

  test('16 result types, one per code, each with name and copy', () => {
    const codes = quiz.resultTypes.map((t: any) => t.code).sort();
    assert.deepEqual(codes, allCodes().sort());
    for (const t of quiz.resultTypes) { assert.ok(t.name && t.tagline && t.ownerReality && t.shareQuote && t.signatureMove, t.code); }
  });

  test('all 16 types are reachable', () => {
    for (const code of allCodes()) assert.equal(scoreQuiz(questions, answersFor(questions, code)).code, code);
  });

  test('strength and scoreData: unanimous = 100%, 3–2 = 60%', () => {
    const s = scoreQuiz(questions, answersFor(questions, 'ESFB'));
    assert.ok(s.dimensions.every(d => d.points === 5 && d.strength === 1 && !d.tie));
    assert.equal(s.scoreData.E, 100); assert.equal(s.scoreData.I, 0);
    const a = answersFor(questions, 'ESFB');
    const ei = questions.filter(q => q.dimension === 'EI');
    for (const q of ei.slice(0, 2)) a[q.id] = a[q.id] === 'right' ? 'left' : 'right'; // flip 2 of 5
    const s2 = scoreQuiz(questions, a);
    assert.equal(s2.code[0], 'E'); assert.equal(s2.dimensions[0].points, 3); assert.equal(s2.scoreData.E, 60);
  });

  test('NEVER-style questions flip: a left swipe scores the other pole', () => {
    const q = questions.find(x => x.statement.includes('NEVER'))!;
    const s = scoreQuiz([q], { [q.id]: 'left' });
    assert.equal(s.dimensions.find(d => d.dimension === q.dimension)!.winner, otherPole(q.dimension, q.rightPole));
  });

  test('lockedCode: null until each letter has 3 of 5, then the final code', () => {
    const full = answersFor(questions, 'INTC');
    const partial: Answers = {};
    for (const d of DIMENSION_ORDER) for (const q of questions.filter(x => x.dimension === d).slice(0, 2)) partial[q.id] = full[q.id];
    assert.equal(lockedCode(questions, partial), null);
    for (const d of DIMENSION_ORDER) { const q = questions.filter(x => x.dimension === d)[2]; partial[q.id] = full[q.id]; }
    assert.equal(lockedCode(questions, partial), 'INTC');
    assert.equal(scoreQuiz(questions, full).code, 'INTC');
  });

  test('validateAnswers: complete only, valid swipes only', () => {
    const a = answersFor(questions, 'ESTB');
    assert.ok(validateAnswers(questions, a));
    const missing = { ...a }; delete missing[questions[0].id];
    assert.ok(!validateAnswers(questions, missing));
    assert.ok(!validateAnswers(questions, { ...a, extra: 'right' }));
    assert.ok(!validateAnswers(questions, { ...a, [questions[0].id]: 'up' }));
    assert.ok(!validateAnswers(questions, null));
  });

  test('every statement uses [PET_NAME]', () => {
    for (const q of questions) assert.ok(q.statement.includes('[PET_NAME]'), q.id);
    assert.equal(withPetName('[PET_NAME] ALWAYS… naps', 'Biscuit'), 'Biscuit ALWAYS… naps');
  });
}

console.log('\nShared');
test('tie with 4 questions goes to the latest answer, marked as a tie', () => {
  const qs: QuizQuestion[] = [1, 2, 3, 4].map(i => ({ id: `q${i}`, dimension: 'EI', rightPole: 'E', statement: '[PET_NAME] x' }));
  const s = scoreQuiz(qs, { q1: 'right', q2: 'right', q3: 'left', q4: 'left' }, ['q1', 'q2', 'q3', 'q4']);
  assert.equal(s.dimensions[0].tie, true); assert.equal(s.dimensions[0].winner, 'I');
  const s2 = scoreQuiz(qs, { q1: 'right', q2: 'right', q3: 'left', q4: 'left' }, ['q3', 'q4', 'q1', 'q2']);
  assert.equal(s2.dimensions[0].winner, 'E');
});
test('seededShuffle is stable for a seed and keeps every item', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  assert.deepEqual(seededShuffle(items, 'abc'), seededShuffle(items, 'abc'));
  assert.deepEqual(seededShuffle(items, 'abc').slice().sort((a, b) => a - b), items);
  assert.notDeepEqual(seededShuffle(items, 'abc'), items);
});

console.log('\nAdmin');
{
  const quiz = content.quizzes[1];
  const qRows: AdminQuestionRow[] = quiz.questions.map((q: any, i: number) => ({
    id: q.key, quiz_id: 'x', dimension: q.dimension, right_pole: q.rightPole, statement: q.statement,
    share_quote: q.shareQuote, visual_brief: q.visualBrief, image_public_id: null, sort_order: i, is_active: q.isActive,
  }));
  const tRows: AdminResultTypeRow[] = quiz.resultTypes.map((t: any) => ({
    id: t.code, quiz_id: 'x', code: t.code, name: t.name, tagline: t.tagline, traits: t.traits,
    signature_move: t.signatureMove, owner_reality: t.ownerReality, share_quote: t.shareQuote, design_image_id: null,
  }));
  test('seed content is publishable (pictures and designs only as notes)', () => {
    const c = checkPublishable(qRows, tRows);
    assert.deepEqual(c.errors, []);
    assert.ok(c.warnings.some(w => w.includes('no picture')) && c.warnings.some(w => w.includes('design')));
  });
  test('publish refused with fewer than 3 active questions on a dimension or a missing type', () => {
    const off = qRows.map(q => (q.dimension === 'BC' && q.id !== qRows.find(x => x.dimension === 'BC')!.id ? { ...q, is_active: false } : q));
    assert.ok(checkPublishable(off, tRows).errors.some(e => e.startsWith('Boldness')));
    assert.ok(checkPublishable(qRows, tRows.slice(1)).errors.some(e => e.includes('missing')));
  });
  test('even question count and one-sided dimension are warned about', () => {
    const four = qRows.filter(q => q.id !== qRows.find(x => x.dimension === 'EI')!.id);
    assert.ok(checkPublishable(four, tRows).warnings.some(w => w.includes('ties')));
    const oneSided = qRows.map(q => (q.dimension === 'SN' ? { ...q, right_pole: 'S' as const } : q));
    assert.ok(checkPublishable(oneSided, tRows).warnings.some(w => w.includes('always gets that letter')));
  });
  test('question input: pole must belong to the dimension; statement required', () => {
    assert.ok('error' in parseQuestionInput({ dimension: 'EI', right_pole: 'S', statement: '[PET_NAME] naps a lot' }, true));
    assert.ok('error' in parseQuestionInput({ dimension: 'EI', right_pole: 'E', statement: ' ' }, true));
    const ok = parseQuestionInput({ dimension: 'EI', right_pole: 'I', statement: '  [PET_NAME]   naps  ' }, true);
    assert.ok('value' in ok && ok.value.statement === '[PET_NAME] naps' && ok.value.is_active === true);
  });
  test('result type input: design must be a uuid, traits trimmed', () => {
    assert.ok('error' in parseResultTypeInput({ design_image_id: 'not-a-uuid' }));
    const ok = parseResultTypeInput({ traits: [' a ', '', 'b'], design_image_id: '' });
    assert.ok('value' in ok && ok.value.traits!.join() === 'a,b' && ok.value.design_image_id === null);
  });
}

console.log(`\n${passed} tests passed`);
