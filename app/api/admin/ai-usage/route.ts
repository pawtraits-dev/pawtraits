import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { MODEL_PRICES, PRICES_AS_OF } from '@/lib/ai/prices';
import { periodStart } from '@/lib/ai/period';

export const dynamic = 'force-dynamic';

/** Admin → AI costs: totals by day / feature / model, cost per customer painting (the call list is /calls) */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get('days')) || 30, 1), 365);
  const to = new Date();
  const from = periodStart(days, to);
  const supabase = serviceClient();

  const [summary, paintings] = await Promise.all([
    supabase.rpc('ai_usage_summary', { p_from: from.toISOString(), p_to: to.toISOString() }),
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
  const costs = Array.from(perImage.values()).map((e) => e.cost).sort((a, b) => a - b);
  const painting = costs.length
    ? { count: costs.length, average: costs.reduce((s, c) => s + c, 0) / costs.length, median: costs[Math.floor(costs.length / 2)], highest: costs[costs.length - 1], withRetries: Array.from(perImage.values()).filter((e) => e.calls > 1).length }
    : null;

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    days,
    rows: summary.data ?? [],
    painting,
    prices: { asOf: PRICES_AS_OF, models: MODEL_PRICES },
  });
}
