'use client';

/**
 * Admin → Quizzes → Results: completions, shares, saves and purchases in a period, how results
 * spread across the 16 types, where quiz takers came from, and the latest results.
 */
import { useEffect, useState } from 'react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import type { AdminResultTypeRow } from '@/lib/quiz/admin';

interface Stats {
  days: number; completions: number; shared: number; saved: number; purchased: number;
  byType: Record<string, number>;
  bySource?: Record<string, { completions: number; shared: number; purchased: number }>;
  recent: { share_code: string; pet_name: string; result_type: string; quiz_version: number; completed_at: string; shared_at: string | null; breed: string | null }[];
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');

/** Plain names for the ?src= values the ways in use; anything else (utm_source, partner tags) shows as is */
const SOURCE_LABELS: Record<string, string> = {
  home: 'Home page band', design: 'Design page', 'order-email': 'Order confirmation email',
  'welcome-email': 'Account email', 'my-pets': 'My pets', shared: "A friend's shared result",
  'result-again': 'Another pet (after their result)', 'short-link': 'pawtraits.pics/quiz', 'shared-portrait': 'A shared customised Pawtrait',
  partner: 'Partner link', direct: 'Direct / unknown', unknown: 'Not recorded',
};

export default function ResultsTab({ quizId, slug, types }: { quizId: string; slug: string; types: AdminResultTypeRow[] }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStats(null);
    (async () => {
      const r = await new AdminSupabaseService().getQuizResults(quizId, days);
      if (r.ok) { setStats(r.data); setError(null); } else setError(r.error);
    })();
  }, [quizId, days]);

  const names = Object.fromEntries(types.map(t => [t.code, t.name]));
  const rows = types.map(t => ({ code: t.code, name: t.name, n: stats?.byType[t.code] ?? 0 })).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...rows.map(r => r.n));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <label htmlFor="period" className="text-sm font-medium">Period</label>
        <select id="period" value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option>
        </select>
      </div>
      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {!stats && !error && <p className="text-sm text-gray-600">Loading…</p>}
      {stats && (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Completed', stats.completions.toLocaleString('en-GB'), ''],
              ['Shared', stats.shared.toLocaleString('en-GB'), pct(stats.shared, stats.completions)],
              ['Saved', stats.saved.toLocaleString('en-GB'), pct(stats.saved, stats.completions)],
              ['Ordered within 30 days', stats.purchased.toLocaleString('en-GB'), pct(stats.purchased, stats.completions)],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
                <dt className="text-sm text-gray-600">{label}</dt>
                <dd className="mt-1 text-2xl font-bold text-gray-900">{value} {sub && <span className="text-sm font-medium text-gray-600">{sub}</span>}</dd>
              </div>
            ))}
          </dl>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 font-semibold text-gray-900">Results by type</h3>
            {stats.completions === 0 ? <p className="text-sm text-gray-600">No results in this period yet.</p> : (
              <ul className="space-y-1.5">
                {rows.map(r => (
                  <li key={r.code} className="grid grid-cols-[52px_minmax(0,180px)_1fr_48px] items-center gap-3 text-sm">
                    <span className="font-mono text-xs font-bold">{r.code}</span>
                    <span className="truncate text-gray-800">{r.name}</span>
                    <span className="h-3 rounded bg-gray-100"><span className="block h-3 rounded bg-purple-600" style={{ width: `${(r.n / max) * 100}%` }} /></span>
                    <span className="text-right tabular-nums text-gray-700">{r.n}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {stats.bySource && Object.keys(stats.bySource).length > 0 && (
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <h3 className="px-4 pt-4 font-semibold text-gray-900">Where quiz takers came from</h3>
              <table className="mt-2 w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr><th className="px-4 py-2 font-medium">Way in</th><th className="px-4 py-2 text-right font-medium">Completed</th><th className="px-4 py-2 text-right font-medium">Shared</th><th className="px-4 py-2 text-right font-medium">Ordered</th></tr>
                </thead>
                <tbody>
                  {Object.entries(stats.bySource).sort((a, b) => b[1].completions - a[1].completions).map(([src, v]) => (
                    <tr key={src} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-900">{SOURCE_LABELS[src] ?? src}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{v.completions}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">{v.shared} <span className="text-gray-500">({pct(v.shared, v.completions)})</span></td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">{v.purchased} <span className="text-gray-500">({pct(v.purchased, v.completions)})</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <h3 className="px-4 pt-4 font-semibold text-gray-900">Latest results</h3>
            <table className="mt-2 w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr><th className="px-4 py-2 font-medium">Pet</th><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2 font-medium">Breed</th><th className="px-4 py-2 font-medium">When</th><th className="px-4 py-2 font-medium">Shared</th></tr>
              </thead>
              <tbody>
                {stats.recent.map(r => (
                  <tr key={r.share_code} className="border-t border-gray-100">
                    <td className="px-4 py-2"><a href={`/quiz/${slug}/r/${r.share_code}`} target="_blank" rel="noreferrer" className="text-purple-700 underline">{r.pet_name}</a></td>
                    <td className="px-4 py-2">{r.result_type} · {names[r.result_type] ?? ''}</td>
                    <td className="px-4 py-2 text-gray-700">{r.breed ?? '–'}</td>
                    <td className="px-4 py-2 text-gray-700">{new Date(r.completed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="px-4 py-2 text-gray-700">{r.shared_at ? 'Yes' : '–'}</td>
                  </tr>
                ))}
                {stats.recent.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-gray-600">No results yet.</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
