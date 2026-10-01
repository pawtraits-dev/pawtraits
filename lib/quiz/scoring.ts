/**
 * Pawsonality scoring. Pure functions, used in the browser (instant reveal) and on the
 * server (authoritative score stored with the result). Client-safe.
 *
 * Rules (spec + decisions 1 Oct 2026):
 * - Each answered question adds 1 point to one pole of its dimension:
 *   right swipe → question.rightPole, left swipe → the other pole.
 * - The letter is the pole with more points. With 5 questions per dimension there are no ties.
 * - If an even count ties (e.g. a question was switched off), the side the latest answered
 *   question on that dimension leaned to wins, and the result is marked as a tie.
 */
import {
  Answers, DIMENSIONS, DIMENSION_ORDER, Dimension, DimensionScore, Pole, QuizQuestion, QuizScore,
} from './types';

export function otherPole(dimension: Dimension, pole: Pole): Pole {
  const [a, b] = DIMENSIONS[dimension];
  return (pole === a ? b : a) as Pole;
}

/** The pole a given answer scores */
export function poleFor(question: QuizQuestion, swipe: 'right' | 'left'): Pole {
  return swipe === 'right' ? question.rightPole : otherPole(question.dimension, question.rightPole);
}

/**
 * Score a completed (or partial) set of answers.
 * `order` = question ids in the order they were answered, used only for tie-breaks.
 */
export function scoreQuiz(questions: QuizQuestion[], answers: Answers, order?: string[]): QuizScore {
  const answeredOrder = order && order.length ? order : questions.map(q => q.id);
  const dimensions: DimensionScore[] = DIMENSION_ORDER.map(dim => {
    const [a, b] = DIMENSIONS[dim];
    const qs = questions.filter(q => q.dimension === dim);
    let pa = 0, pb = 0, latest: Pole | null = null;
    for (const id of answeredOrder) {
      const q = qs.find(x => x.id === id);
      const swipe = q ? answers[q.id] : undefined;
      if (!q || !swipe) continue;
      const p = poleFor(q, swipe);
      if (p === a) pa++; else pb++;
      latest = p;
    }
    const total = qs.length;
    const tie = pa === pb;
    const winner = (pa > pb ? a : pb > pa ? b : (latest ?? a)) as Pole;
    const points = winner === a ? pa : pb;
    return { dimension: dim, winner, points, total, strength: total ? points / total : 0, tie };
  });

  const scoreData = {} as Record<Pole, number>;
  for (const d of dimensions) {
    const [a, b] = DIMENSIONS[d.dimension];
    const loser = d.winner === a ? b : a;
    const answered = questions.filter(q => q.dimension === d.dimension && answers[q.id]).length || 1;
    const winPct = Math.round((d.points / answered) * 100);
    scoreData[d.winner] = winPct;
    scoreData[loser as Pole] = 100 - winPct;
  }

  return { code: dimensions.map(d => d.winner).join(''), dimensions, scoreData };
}

/**
 * Which letters can no longer change, given the answers so far. A letter locks once one pole
 * has more than half of that dimension's questions. Returns the code when all four are locked
 * (used to start painting the breed-matched result picture before the last swipe), else null.
 */
export function lockedCode(questions: QuizQuestion[], answers: Answers): string | null {
  const letters: string[] = [];
  for (const dim of DIMENSION_ORDER) {
    const [a] = DIMENSIONS[dim];
    const qs = questions.filter(q => q.dimension === dim);
    const need = Math.floor(qs.length / 2) + 1;
    let pa = 0, pb = 0;
    for (const q of qs) {
      const s = answers[q.id];
      if (!s) continue;
      if (poleFor(q, s) === a) pa++; else pb++;
    }
    if (pa >= need) letters.push(DIMENSIONS[dim][0]);
    else if (pb >= need) letters.push(DIMENSIONS[dim][1]);
    else return null;
  }
  return letters.join('');
}

/** Check a submission covers every question exactly, with valid swipes. */
export function validateAnswers(questions: QuizQuestion[], answers: unknown): answers is Answers {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
  const a = answers as Record<string, unknown>;
  const ids = new Set(questions.map(q => q.id));
  if (Object.keys(a).length !== ids.size) return false;
  return Object.entries(a).every(([id, v]) => ids.has(id) && (v === 'right' || v === 'left'));
}

/** Replace [PET_NAME] tokens. Name is trimmed and capped; HTML is escaped by React at render. */
export function withPetName(text: string | null | undefined, petName: string): string {
  const name = (petName || '').trim().slice(0, 30) || 'Your pet';
  return (text || '').replace(/\[PET_NAME\]/g, name);
}

/** Shuffle with a seed so a refresh mid-quiz keeps the same order. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1_000_000) / 1_000_000; };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
