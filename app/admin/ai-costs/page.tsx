'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { FEATURES, num, usd, int } from '@/lib/ai/feature-labels';
import AiCallsTable from '@/components/admin/AiCallsTable';

type Row = {
  day: string; feature: string; model: string; is_batch: boolean; calls: number; failures: number; images: number;
  input_tokens: number; thinking_tokens: number; output_text_tokens: number; output_image_tokens: number;
  cost_input_usd: number; cost_thinking_usd: number; cost_output_usd: number; cost_usd: number; unpriced_calls: number; avg_duration_ms: number;
};
type Data = {
  from: string; to: string; days: number; rows: Row[];
  painting: { count: number; average: number; median: number; highest: number; withRetries: number } | null;
  prices: { asOf: string; models: Record<string, { label: string; input: number; outputText: number; outputImage?: number }> };
};

const PERIODS = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–');

function group<K extends string>(rows: Row[], key: (r: Row) => K) {
  const m = new Map<K, { calls: number; failures: number; images: number; cost: number; input: number; thinking: number; output: number; tokensIn: number; tokensThink: number; tokensImg: number; unpriced: number; durSum: number }>();
  for (const r of rows) {
    const k = key(r);
    const e = m.get(k) ?? { calls: 0, failures: 0, images: 0, cost: 0, input: 0, thinking: 0, output: 0, tokensIn: 0, tokensThink: 0, tokensImg: 0, unpriced: 0, durSum: 0 };
    e.calls += num(r.calls); e.failures += num(r.failures); e.images += num(r.images);
    e.cost += num(r.cost_usd); e.input += num(r.cost_input_usd); e.thinking += num(r.cost_thinking_usd); e.output += num(r.cost_output_usd);
    e.tokensIn += num(r.input_tokens); e.tokensThink += num(r.thinking_tokens); e.tokensImg += num(r.output_image_tokens);
    e.unpriced += num(r.unpriced_calls); e.durSum += num(r.avg_duration_ms) * num(r.calls);
    m.set(k, e);
  }
  return Array.from(m.entries()).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.cost - a.cost);
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">{value}</p>
      {note && <p className="text-xs text-gray-500 mt-1">{note}</p>}
    </div>
  );
}

/** Daily spend, one bar per day, hover for the numbers */
function DailySpend({ days, from }: { days: { day: string; cost: number; calls: number; images: number }[]; from: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.cost), 0.0001);
  const ticks = [max, max / 2, 0];
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Spend per day</h2>
        <p className="text-xs text-gray-500">US dollars · from {new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
      </div>
      <div className="relative flex gap-2">
        <div className="flex flex-col justify-between text-[11px] text-gray-500 tabular-nums h-40 pr-1 text-right w-12 shrink-0">
          {ticks.map((t, i) => <span key={i}>{usd(t)}</span>)}
        </div>
        <div className="relative flex-1 h-40 border-b border-gray-300">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-200" />
          <div className="absolute inset-0 flex items-end" style={{ gap: days.length > 40 ? 1 : 2 }}>
            {days.map((d, i) => (
              <div
                key={d.day}
                className="relative flex-1 h-full flex items-end cursor-default"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                aria-label={`${d.day}: ${usd(d.cost)}, ${d.calls} calls`}
              >
                <div
                  className={`w-full rounded-t-[4px] ${hover === i ? 'bg-purple-800' : 'bg-purple-600'}`}
                  style={{ height: `${d.cost > 0 ? Math.max((d.cost / max) * 100, 1.5) : 0}%` }}
                />
              </div>
            ))}
          </div>
          {hover !== null && days[hover] && (
            <div
              className="absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md bg-gray-900 text-white text-xs px-2.5 py-1.5 shadow-lg pointer-events-none whitespace-nowrap"
              style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
            >
              <div className="font-medium">{new Date(days[hover].day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
              <div className="tabular-nums">{usd(days[hover].cost)} · {days[hover].calls} calls · {days[hover].images} images</div>
            </div>
          )}
        </div>
      </div>
      {days.length <= 31 && (
        <div className="flex gap-2 mt-1">
          <div className="w-12 shrink-0" />
          <div className="flex-1 flex text-[10px] text-gray-500" style={{ gap: 2 }}>
            {days.map((d, i) => (
              <span key={d.day} className="flex-1 text-center">
                {days.length <= 10 || i % Math.ceil(days.length / 10) === 0 ? new Date(d.day).getDate() : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AiCostsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (d = days) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai-usage?days=${d}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load AI costs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => {
    if (!data) return null;
    const rows = data.rows;
    const total = group(rows, () => 'all' as const)[0];
    const byFeature = group(rows, (r) => r.feature);
    const byModel = group(rows, (r) => `${r.model}${r.is_batch ? ' (batch)' : ''}`);
    const byDayMap = new Map(group(rows, (r) => r.day).map((d) => [d.key, d]));
    const series: { day: string; cost: number; calls: number; images: number }[] = [];
    const start = new Date(data.from);
    for (let i = 0; i < data.days; i++) {
      const d = new Date(start.getTime() + i * 86_400_000 + 12 * 3_600_000);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
      const e = byDayMap.get(key);
      series.push({ day: key, cost: e?.cost ?? 0, calls: e?.calls ?? 0, images: e?.images ?? 0 });
    }
    const imageRows = rows.filter((r) => num(r.images) > 0);
    const imageCost = imageRows.reduce((s, r) => s + num(r.cost_usd), 0);
    const images = imageRows.reduce((s, r) => s + num(r.images), 0);
    return { total, byFeature, byModel, series, perImage: images ? imageCost / images : 0, images };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-600" />
            AI Costs
          </h1>
          <p className="text-gray-600 mt-2">What every Gemini and Claude call costs, worked out from the tokens each one used</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-white p-1" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                aria-pressed={days === p.days}
                className={`px-3 py-1.5 text-sm rounded-md ${days === p.days ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => load()} className="p-2 rounded-lg border bg-white hover:bg-gray-50" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {data && view && (
        <>
          {!view.total ? (
            <div className="bg-white border rounded-lg p-8 text-center text-gray-600">
              No AI calls recorded in this period yet. Calls are logged from the moment this version is live.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Stat label="Spend" value={usd(view.total.cost)} note={view.total.unpriced ? `${view.total.unpriced} calls on a model with no price` : undefined} />
                <Stat label="AI calls" value={int(view.total.calls)} note={view.total.failures ? `${view.total.failures} failed` : 'none failed'} />
                <Stat label="Images made" value={int(view.images)} />
                <Stat label="Per image" value={usd(view.perImage)} note="all image calls, incl. input and thinking" />
                <Stat
                  label="Per customer painting"
                  value={data.painting ? usd(data.painting.average) : '–'}
                  note={data.painting ? `${data.painting.count} paintings · median ${usd(data.painting.median)} · ${data.painting.withRetries} with retries` : 'none yet'}
                />
              </div>

              <DailySpend days={view.series} from={data.from} />

              <div className="bg-white rounded-lg border p-4">
                <h2 className="font-semibold text-gray-900 mb-1">Where the money goes</h2>
                <p className="text-xs text-gray-500 mb-3">Nano Banana 2.1 halved the image price but charges more for input and thinking; this shows whether that matters.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Input (prompts and photos)', cost: view.total.input, tokens: view.total.tokensIn },
                    { label: 'Thinking', cost: view.total.thinking, tokens: view.total.tokensThink },
                    { label: 'Output (images and text)', cost: view.total.output, tokens: view.total.tokensImg },
                  ].map((p) => (
                    <div key={p.label} className="rounded-md bg-gray-50 p-3">
                      <p className="text-sm text-gray-600">{p.label}</p>
                      <p className="text-xl font-semibold tabular-nums">{usd(p.cost)} <span className="text-sm font-normal text-gray-500">{pct(p.cost, view.total.cost)}</span></p>
                      <p className="text-xs text-gray-500 tabular-nums">{int(p.tokens)} tokens{p.label.startsWith('Output') ? ' (image)' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[{ title: 'By feature', rows: view.byFeature, label: (k: string) => FEATURES[k] ?? k },
                  { title: 'By model', rows: view.byModel, label: (k: string) => { const base = k.replace(' (batch)', ''); return `${data.prices.models[base]?.label ?? base}${k.endsWith('(batch)') ? ' · batch' : ''}`; } }].map((t) => (
                  <div key={t.title} className="bg-white rounded-lg border overflow-hidden">
                    <h2 className="font-semibold text-gray-900 px-4 pt-4 pb-2">{t.title}</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 border-b">
                          <tr>
                            <th className="text-left font-medium px-4 py-2"> </th>
                            <th className="text-right font-medium px-2 py-2">Calls</th>
                            <th className="text-right font-medium px-2 py-2">Images</th>
                            <th className="text-right font-medium px-2 py-2">Avg time</th>
                            <th className="text-right font-medium px-2 py-2">Per call</th>
                            <th className="text-right font-medium px-4 py-2">Spend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.map((r) => (
                            <tr key={r.key} className="border-b last:border-0">
                              <td className="px-4 py-2 text-gray-900">
                                {t.label(r.key)}
                                {r.failures > 0 && <span className="ml-2 text-xs text-red-700">{r.failures} failed</span>}
                              </td>
                              <td className="text-right px-2 py-2 tabular-nums">{int(r.calls)}</td>
                              <td className="text-right px-2 py-2 tabular-nums">{r.images ? int(r.images) : '–'}</td>
                              <td className="text-right px-2 py-2 tabular-nums text-gray-600">{r.calls ? `${(r.durSum / r.calls / 1000).toFixed(1)}s` : '–'}</td>
                              <td className="text-right px-2 py-2 tabular-nums text-gray-600">{usd(r.calls ? r.cost / r.calls : 0)}</td>
                              <td className="text-right px-4 py-2 tabular-nums font-medium">{usd(r.cost)} <span className="text-xs font-normal text-gray-500">{pct(r.cost, view.total.cost)}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              <AiCallsTable
                days={data.days}
                refreshKey={data.to}
                features={view.byFeature.map((f) => f.key)}
                models={Array.from(new Set(data.rows.map((r) => r.model)))}
                modelLabels={Object.fromEntries(Object.entries(data.prices.models).map(([id, p]) => [id, p.label]))}
              />
            </>
          )}

          <details className="bg-white rounded-lg border p-4 text-sm">
            <summary className="cursor-pointer font-medium text-gray-900">Prices used (as of {data.prices.asOf})</summary>
            <p className="text-gray-600 mt-2 mb-3">US dollars per million tokens. Batch calls are charged at half. Change them in <code>lib/ai/prices.ts</code>; each call keeps the price it was charged at.</p>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead className="text-xs text-gray-500"><tr><th className="text-left pr-6 py-1">Model</th><th className="text-right pr-6">Input</th><th className="text-right pr-6">Thinking / text</th><th className="text-right">Image out</th></tr></thead>
                <tbody>
                  {Object.entries(data.prices.models).map(([id, p]) => (
                    <tr key={id}><td className="pr-6 py-1">{p.label} <span className="text-gray-500">({id})</span></td><td className="text-right pr-6 tabular-nums">${p.input}</td><td className="text-right pr-6 tabular-nums">${p.outputText}</td><td className="text-right tabular-nums">{p.outputImage ? `$${p.outputImage}` : '–'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
