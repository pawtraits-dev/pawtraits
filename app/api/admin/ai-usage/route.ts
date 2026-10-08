import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { MODEL_PRICES, PRICES_AS_OF } from '@/lib/ai/prices';

export const dynamic = 'force-dynamic';

function londonMidnight(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const sinceMidnight = ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - sinceMidnight);
}

/** Admin → AI costs: totals by day / feature / model, cost per customer painting, priciest calls */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get('days')) || 30, 1), 365);
  const to = new Date();
  // Periods start at London midnight: 1 = today, 7 = today and the 6 days before, …
  const from = new Date(londonMidnight(to).getTime() - (days - 1) * 86_400_000);
  const supabase = serviceClient();

  const [summary, top, paintings] = await Promise.all([
    supabase.rpc('ai_usage_summary', { p_from: from.toISOString(), p_to: to.toISOString() }),
    supabase.from('ai_usage')
      .select('id, created_at, feature, model, is_batch, image_size, input_tokens, thinking_tokens, output_text_tokens, output_image_tokens, output_images, cost_usd, success, error, duration_ms, image_id, customer_image_id, batch_job_id')
      .gte('created_at', from.toISOString())
      .order('cost_usd', { ascending: false, nullsFirst: false })
      .limit(15),
    supabase.from('ai_usage')
      .select('customer_image_id, cost_usd, success')
      .gte('created_at', from.toISOString())
      .not('customer_image_id', 'is', null)
      .limit(5000),
  ]);

  if (summary.error) {
    const missing = /ai_usage|function .* does not exist/i.test(summary.error.message);
    return NextResponse.json({ error: missing ? 'Run db/migrations/2026-10-16-ai-usage.sql to start tracking.' : summary.error.message }, { status: missing ? 503 : 500 });
  }

  // Cost per customer painting = every call made for that image (attempts, retries, print master)
  const perImage = new Map<string, { cost: number; calls: number; failures: number }>();
  for (const r of paintings.data ?? []) {
    const e = perImage.get(r.customer_image_id) ?? { cost: 0, calls: 0, failures: 0 };
    e.cost += Number(r.cost_usd ?? 0); e.calls += 1; if (!r.success) e.failures += 1;
    perImage.set(r.customer_image_id, e);
  }
  const costs = [...perImage.values()].map((e) => e.cost).sort((a, b) => a - b);
  const painting = costs.length
    ? { count: costs.length, average: costs.reduce((s, c) => s + c, 0) / costs.length, median: costs[Math.floor(costs.length / 2)], highest: costs[costs.length - 1], withRetries: [...perImage.values()].filter((e) => e.calls > 1).length }
    : null;

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    days,
    rows: summary.data ?? [],
    top: top.data ?? [],
    painting,
    prices: { asOf: PRICES_AS_OF, models: MODEL_PRICES },
  });
}
