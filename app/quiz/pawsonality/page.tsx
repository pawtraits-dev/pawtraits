'use client';

/**
 * 16 Pawsonalities quiz (spec docs/specs/pawsonality-quiz.md, phase 3).
 * Start (name, dog/cat, breed) → 20 swipe cards (drag, buttons or arrow keys, undo) → reveal →
 * result page. Progress survives a refresh (sessionStorage). The browser scores for the instant
 * reveal; the server re-scores and stores the result (POST /api/public/quiz/pawsonality/results).
 * Ways in (phase 5) link here with ?src= (home, design, order-email, welcome-email, my-pets,
 * shared, result-again) so admin can see which work; My pets also passes ?pet=&name=&breed=.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, RotateCcw, X } from 'lucide-react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import SwipeCard, { type SwipeCardHandle } from '@/components/quiz/SwipeCard';
import { lockedCode, scoreQuiz, seededShuffle, withPetName } from '@/lib/quiz/scoring';
import type { AnimalType, Answers, Dimension, Pole, Swipe } from '@/lib/quiz/types';
import { track } from '@/lib/tracking/events';

const SLUG = 'pawsonality';
const STORAGE_KEY = 'pawtraits.quiz.pawsonality.v1';
const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ '’.-]{0,29}$/;
const MIN_REVEAL_MS = 1800;
const MINE_KEY = 'pawtraits.quiz.mine'; // share codes taken in this browser (result page: owner vs visitor)
const SOURCE_RE = /^[a-z0-9_-]{1,32}$/;

/** Where this quiz taker came from: ?src=, else utm_source, else a partner link, else direct */
function entrySource(qs: URLSearchParams): string {
  for (const v of [qs.get('src'), qs.get('utm_source')]) {
    const s = v?.trim().toLowerCase();
    if (s && SOURCE_RE.test(s)) return s;
  }
  return qs.get('partner') ? 'partner' : 'direct';
}

function rememberMine(shareCode: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(MINE_KEY) || '[]');
    localStorage.setItem(MINE_KEY, JSON.stringify([shareCode, ...list.filter(c => c !== shareCode)].slice(0, 20)));
  } catch { /* storage blocked */ }
}

interface PublicQuestion { id: string; dimension: Dimension; rightPole: Pole; statement: string; imageUrl: string | null }
interface PublicQuiz { slug: string; animalType: AnimalType; version: number; questions: PublicQuestion[]; resultTypes: { code: string; name: string }[] }
interface Breed { id: string; name: string; animal_type: AnimalType; is_active?: boolean }

interface Progress {
  animal: AnimalType; petName: string; breedId: string | null; breedName: string;
  version: number; seed: string; history: string[]; answers: Answers;
  source?: string; petId?: string | null;
}

type Step = 'start' | 'cards' | 'reveal';

function load(): Progress | null {
  try { const raw = sessionStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function save(p: Progress | null) {
  try { if (p) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p)); else sessionStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
}

/** "Biscuit ALWAYS… naps" → lead "Biscuit ALWAYS…", rest "naps" */
function split(statement: string, petName: string) {
  const text = withPetName(statement, petName);
  const m = text.match(/^(.*?\b(?:ALWAYS|NEVER)\s*(?:…|\.\.\.))\s*(.*)$/);
  return m ? { lead: m[1], rest: m[2] } : { lead: petName, rest: text };
}

export default function PawsonalityQuizPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('start');
  const [animal, setAnimal] = useState<AnimalType>('dog');
  const [petName, setPetName] = useState('');
  const [breedName, setBreedName] = useState('');
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attribution, setAttribution] = useState<{ partnerCode?: string; referralCode?: string }>({});
  const [entry, setEntry] = useState<{ source: string; petId: string | null; breedId: string | null }>({ source: 'direct', petId: null, breedId: null });
  const flingRef = useRef<SwipeCardHandle | null>(null);
  const [lean, setLean] = useState(0); // card drag: <0 towards "not", >0 towards "totally" 
  const paintingFor = useRef<string | null>(null); // type code whose breed picture we've asked for

  // Attribution, preselected species, and a quiz in progress (refresh-safe)
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const a = qs.get('animal');
    if (a === 'cat' || a === 'dog') setAnimal(a);
    // Started from My pets: their pet's name and breed are filled in
    const name = qs.get('name')?.trim();
    if (name && NAME_RE.test(name)) setPetName(name);
    const uuid = /^[0-9a-f-]{36}$/i;
    const pet = qs.get('pet'); const breed = qs.get('breed');
    setEntry({ source: entrySource(qs), petId: pet && uuid.test(pet) ? pet : null, breedId: breed && uuid.test(breed) ? breed : null });
    let referralCode: string | undefined;
    try {
      const ref = qs.get('ref');
      if (ref) localStorage.setItem('referralCode', ref.toUpperCase());
      referralCode = localStorage.getItem('referralCode') || undefined;
    } catch { /* storage blocked */ }
    setAttribution({ partnerCode: qs.get('partner') || undefined, referralCode });

    const saved = load();
    if (saved && saved.history.length > 0) {
      setAnimal(saved.animal); setPetName(saved.petName); setBreedName(saved.breedName);
      (async () => {
        const q = await fetchQuiz(saved.animal);
        if (q && q.version === saved.version) { setQuiz(q); setProgress(saved); setStep('cards'); }
        else save(null);
      })();
    }
  }, []);

  useEffect(() => {
    fetch('/api/public/breeds').then(r => (r.ok ? r.json() : [])).then((rows: Breed[]) => {
      setBreeds(Array.isArray(rows) ? rows.filter(b => b.is_active !== false) : []);
    }).catch(() => setBreeds([]));
  }, []);

  // Prefilled breed (from My pets) once the breed list has loaded
  useEffect(() => {
    if (!entry.breedId || breedName) return;
    const b = breeds.find(x => x.id === entry.breedId);
    if (b) setBreedName(b.name);
  }, [breeds, entry.breedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const speciesBreeds = useMemo(
    () => breeds.filter(b => b.animal_type === animal).sort((a, b) => a.name.localeCompare(b.name)),
    [breeds, animal],
  );

  async function fetchQuiz(a: AnimalType): Promise<PublicQuiz | null> {
    try {
      const r = await fetch(`/api/public/quiz/${SLUG}?animal=${a}`);
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }

  async function begin(e: React.FormEvent) {
    e.preventDefault();
    const name = petName.trim();
    if (!NAME_RE.test(name)) { setError("Please give your pet's name (letters only, up to 30)."); return; }
    setLoading(true); setError(null);
    const q = await fetchQuiz(animal);
    setLoading(false);
    if (!q) { setError('The quiz is having a nap. Please try again in a moment.'); return; }
    const breed = speciesBreeds.find(b => b.name.toLowerCase() === breedName.trim().toLowerCase()) ?? null;
    const p: Progress = {
      animal, petName: name, breedId: breed?.id ?? null, breedName: breed?.name ?? '',
      version: q.version, seed: Math.random().toString(36).slice(2), history: [], answers: {},
      source: entry.source, petId: entry.petId,
    };
    setQuiz(q); setProgress(p); save(p); setStep('cards');
    track.quizStart(SLUG, animal, entry.source);
    window.scrollTo({ top: 0 });
  }

  const order = useMemo(
    () => (quiz && progress ? seededShuffle(quiz.questions, progress.seed) : []),
    [quiz, progress?.seed], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const index = progress?.history.length ?? 0;
  const current = order[index];
  const total = order.length;

  const submit = useCallback(async (p: Progress, q: PublicQuiz) => {
    setStep('reveal');
    const started = Date.now();
    const localCode = scoreQuiz(q.questions, p.answers, p.history).code;
    try {
      const r = await fetch(`/api/public/quiz/${SLUG}/results`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animal: p.animal, petName: p.petName, breedId: p.breedId, answers: p.answers, order: p.history,
          source: p.source, petId: p.petId ?? undefined, ...attribution,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.status === 409) {
        // The quiz was updated while they were answering: start again on the new version
        save(null); setProgress(null); setQuiz(null); setStep('start');
        setError("We've just updated the quiz, so it needs a fresh start. Sorry about that!");
        return;
      }
      if (!r.ok || !body.shareCode) throw new Error(body.error || 'Could not save');
      await new Promise(res => setTimeout(res, Math.max(0, MIN_REVEAL_MS - (Date.now() - started))));
      track.quizComplete(SLUG, body.code || localCode, p.animal);
      save(null);
      rememberMine(body.shareCode);
      router.push(`/quiz/${SLUG}/r/${body.shareCode}`);
    } catch (err: any) {
      setStep('cards');
      setError(err?.message === 'Failed to fetch' ? 'No connection. Check your signal and try again.' : (err?.message || 'Something went wrong. Please try again.'));
    }
  }, [attribution, router]);

  const answer = useCallback((swipe: Swipe) => {
    if (!progress || !quiz || !current) return;
    const next: Progress = { ...progress, history: [...progress.history, current.id], answers: { ...progress.answers, [current.id]: swipe } };
    setProgress(next); save(next);
    track.quizAnswer(SLUG, next.history.length, total);
    // Once every letter is settled, start painting the type as their breed (finishes while they read the reveal)
    if (next.breedId && !paintingFor.current) {
      const code = lockedCode(quiz.questions, next.answers);
      if (code) {
        paintingFor.current = code;
        fetch(`/api/public/quiz/${SLUG}/breed-image`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animal: next.animal, code, breedId: next.breedId }),
        }).catch(() => { /* the result page retries */ });
      }
    }
    if (next.history.length >= total) submit(next, quiz);
  }, [progress, quiz, current, total, submit]);

  function undo() {
    if (!progress || progress.history.length === 0) return;
    const history = progress.history.slice(0, -1);
    const answers = { ...progress.answers };
    delete answers[progress.history[progress.history.length - 1]];
    const next = { ...progress, history, answers };
    setProgress(next); save(next); setError(null);
  }

  function leave() {
    save(null); setProgress(null); setQuiz(null); setStep('start'); setError(null);
  }

  // Arrow keys answer while the cards are showing
  useEffect(() => {
    if (step !== 'cards') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); flingRef.current?.fling('right'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); flingRef.current?.fling('left'); }
      else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Reveal ----------
  if (step === 'reveal' && progress) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#2A1A52] px-8 text-center text-white" aria-live="polite">
        <div className="flex h-28 w-28 animate-pulse items-center justify-center rounded-full bg-white/10">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="#C9B6F2" aria-hidden="true"><circle cx="5.5" cy="10" r="2.5" /><circle cx="9.5" cy="5.5" r="2.5" /><circle cx="14.5" cy="5.5" r="2.5" /><circle cx="18.5" cy="10" r="2.5" /><path d="M12 11c-3.5 0-6 3.2-6 6 0 2 1.6 3 3.2 3 1.3 0 1.8-.6 2.8-.6s1.5.6 2.8.6c1.6 0 3.2-1 3.2-3 0-2.8-2.5-6-6-6z" /></svg>
        </div>
        <h1 className="text-[2rem] leading-tight" style={lifeSavers}>Pawcasso is reading {progress.petName}&rsquo;s mind…</h1>
        <p className="max-w-xs text-[#D9CDF5]">Weighing up the zoomies, the naps and that thing with the post.</p>
      </main>
    );
  }

  // ---------- Cards ----------
  if (step === 'cards' && progress && quiz && current) {
    const { lead, rest } = split(current.statement, progress.petName);
    const petLabel = progress.petName?.trim() || 'my pet';
    const leaningNo = lean < -0.15;
    const pct = Math.round((index / total) * 100);
    return (
      <main className="flex min-h-[100dvh] flex-col bg-[#F6F2FC] text-gray-900">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pt-3">
          <button type="button" onClick={leave} aria-label="Leave the quiz" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/70">
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-purple-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index} aria-label="Quiz progress">
            <div className="h-2 rounded-full bg-purple-700 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-sm font-semibold text-gray-700">{index + 1} of {total}</span>
        </div>

        <div className="relative mx-auto mt-5 w-full max-w-md flex-1 px-6" style={{ minHeight: 420, maxHeight: 560 }}>
          {order[index + 1] && (
            <div className="absolute inset-x-10 top-4 bottom-[-10px] rounded-[22px] border border-purple-100 bg-white/70" aria-hidden="true" />
          )}
          <div className="absolute inset-x-6 inset-y-0">
            <SwipeCard key={current.id} lead={lead} statement={rest} imageUrl={current.imageUrl}
              dimension={current.dimension} onAnswer={answer} flingRef={flingRef} onLean={setLean} petLabel={petLabel} />
          </div>
          <p className="sr-only" aria-live="polite">{`Question ${index + 1} of ${total}: ${lead} ${rest}`}</p>
        </div>

        <div className="mx-auto w-full max-w-md px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-6">
          {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {/* The button the card is leaning towards lights up (default: "Totally") */}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => flingRef.current?.fling('left')}
              style={{ transform: lean < 0 ? `scale(${1 + 0.05 * -lean})` : undefined }}
              className={`flex h-14 min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 text-[15px] font-bold transition-colors duration-150 active:scale-[0.98] ${leaningNo ? 'bg-purple-700 text-white' : 'border-[1.5px] border-gray-300 bg-white text-gray-900'}`}>
              <X className="h-5 w-5 shrink-0" aria-hidden="true" /> <span className="truncate">Not {petLabel}</span>
            </button>
            <button type="button" onClick={() => flingRef.current?.fling('right')}
              style={{ transform: lean > 0 ? `scale(${1 + 0.05 * lean})` : undefined }}
              className={`flex h-14 min-w-0 items-center justify-center gap-1.5 rounded-2xl px-2 text-[15px] font-bold transition-colors duration-150 active:scale-[0.98] ${leaningNo ? 'border-[1.5px] border-gray-300 bg-white text-gray-900' : 'bg-purple-700 text-white'}`}>
              <Check className="h-5 w-5 shrink-0" aria-hidden="true" /> <span className="truncate">Totally {petLabel}</span>
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={undo} disabled={index === 0}
              className="flex h-11 items-center gap-1.5 px-1 text-sm font-semibold text-purple-800 disabled:text-gray-400">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Undo
            </button>
            <span className="text-sm text-gray-600">Or swipe the card</span>
          </div>
        </div>
      </main>
    );
  }

  // ---------- Start ----------
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <UserAwareNavigation />
      <main>
        <section className="bg-[#F6F2FC] px-5 pb-6 pt-6">
          <div className="mx-auto max-w-md">
            <span className="inline-flex items-center rounded-full border border-purple-200 bg-white px-3 py-1 text-sm font-semibold text-purple-800">
              Free · about 90 seconds · no sign-up
            </span>
            <h1 className="mt-3 text-[2.25rem] leading-[1.08]" style={lifeSavers}>What&rsquo;s your pet&rsquo;s Pawsonality?</h1>
            <p className="mt-2 text-gray-700">
              20 quick swipes, 16 possible types, and one suspiciously accurate result, painted as a Pawtrait of your pet&rsquo;s breed.
            </p>
          </div>
        </section>

        <form onSubmit={begin} className="mx-auto flex max-w-md flex-col gap-4 px-5 py-6" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pet-name" className="text-sm font-semibold">Your pet&rsquo;s name</label>
            <input id="pet-name" type="text" autoComplete="off" maxLength={30} value={petName}
              onChange={e => setPetName(e.target.value.replace(/^\s+/, '').replace(/^./, c => c.toUpperCase()))}
              className="h-12 rounded-xl border-[1.5px] border-gray-300 px-4 text-base focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200" />
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">Dog or cat?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['dog', 'cat'] as AnimalType[]).map(a => (
                <button key={a} type="button" aria-pressed={animal === a} onClick={() => { setAnimal(a); setBreedName(''); }}
                  className={`h-12 rounded-xl text-base ${animal === a ? 'border-2 border-purple-700 bg-purple-50 font-bold text-purple-900' : 'border-[1.5px] border-gray-300 bg-white font-medium'}`}>
                  {a === 'dog' ? 'Dog' : 'Cat'}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="breed" className="text-sm font-semibold">Breed <span className="font-normal text-gray-600">(optional)</span></label>
            <input id="breed" type="text" list="breed-list" autoComplete="off" value={breedName} onChange={e => setBreedName(e.target.value)}
              placeholder={animal === 'dog' ? 'e.g. Labrador Retriever' : 'e.g. Maine Coon'}
              className="h-12 rounded-xl border-[1.5px] border-gray-300 px-4 text-base focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200" />
            <datalist id="breed-list">
              {speciesBreeds.map(b => <option key={b.id} value={b.name} />)}
            </datalist>
            <span className="text-sm text-gray-600">
              {petName.trim() ? `So ${petName.trim()}’s result is painted as their breed.` : 'So the result is painted as your pet’s breed.'} Mixed or not sure? Leave it blank.
            </span>
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={loading}
            className="mt-1 h-[52px] rounded-xl bg-purple-700 text-base font-bold text-white hover:bg-purple-800 disabled:opacity-60">
            {loading ? 'Getting the questions…' : 'Start the quiz'}
          </button>
        </form>
      </main>
    </div>
  );
}

