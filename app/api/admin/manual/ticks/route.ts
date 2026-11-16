/**
 * Operating manual checklist ticks, shared by everyone who works in the admin.
 *   GET  ?date=YYYY-MM-DD  -> ticks for that day, and for the week and month it falls in
 *   POST { key, period, periodStart, done } -> tick (done: true) or untick (done: false, deletes the row)
 * Table: ops_checklist_ticks (db/migrations/2026-11-16-ops-checklist.sql). Until it exists, GET answers
 * { ticks: [], tableMissing: true } and POST answers 503 with tableMissing, and the page keeps ticks in the browser.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity, requireAdmin, serviceClient } from '@/lib/qr/server';
import { isValidYmd, isoWeekday, monthStart, weekStart } from '@/lib/admin/manual/dates';
import { allTasks, periodOfTask } from '@/lib/admin/manual/content';

export const dynamic = 'force-dynamic';

const PERIODS = ['day', 'week', 'month'] as const;

function tableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /ops_checklist_ticks/.test(error.message ?? '') && /does not exist|schema cache/i.test(error.message ?? '');
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;

  const date = new URL(request.url).searchParams.get('date');
  if (!isValidYmd(date)) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });

  const { data, error } = await serviceClient()
    .from('ops_checklist_ticks')
    .select('task_key, period, period_start, done_by_name, done_at')
    .or(`and(period.eq.day,period_start.eq.${date}),and(period.eq.week,period_start.eq.${weekStart(date)}),and(period.eq.month,period_start.eq.${monthStart(date)})`);

  if (error) {
    if (tableMissing(error)) return NextResponse.json({ ticks: [], tableMissing: true });
    console.error('manual ticks GET failed:', error);
    return NextResponse.json({ error: 'Could not load the checklist' }, { status: 500 });
  }
  return NextResponse.json({ ticks: data ?? [], tableMissing: false });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { key, period, periodStart, done } = body ?? {};

  if (typeof key !== 'string' || !allTasks().some(t => t.key === key)) return NextResponse.json({ error: 'Unknown task' }, { status: 400 });
  if (!PERIODS.includes(period)) return NextResponse.json({ error: 'period must be day, week or month' }, { status: 400 });
  if (periodOfTask(key) !== period) return NextResponse.json({ error: 'That task is not ticked by this period' }, { status: 400 });
  if (!isValidYmd(periodStart)) return NextResponse.json({ error: 'periodStart must be YYYY-MM-DD' }, { status: 400 });
  if (period === 'week' && isoWeekday(periodStart) !== 1) return NextResponse.json({ error: 'A week starts on a Monday' }, { status: 400 });
  if (period === 'month' && periodStart.slice(8) !== '01') return NextResponse.json({ error: 'A month starts on the 1st' }, { status: 400 });
  if (typeof done !== 'boolean') return NextResponse.json({ error: 'done must be true or false' }, { status: 400 });

  const db = serviceClient();

  if (!done) {
    const { error } = await db.from('ops_checklist_ticks').delete().eq('task_key', key).eq('period', period).eq('period_start', periodStart);
    if (error) {
      if (tableMissing(error)) return NextResponse.json({ error: 'Checklist table not added yet', tableMissing: true }, { status: 503 });
      console.error('manual ticks DELETE failed:', error);
      return NextResponse.json({ error: 'Could not untick' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const who = await getAdminIdentity();
  // Keep the first tick if two people tick at once
  const { error } = await db.from('ops_checklist_ticks').upsert(
    { task_key: key, period, period_start: periodStart, done_by: who?.id ?? null, done_by_name: who?.firstName ?? null },
    { onConflict: 'task_key,period,period_start', ignoreDuplicates: true },
  );
  if (error) {
    if (tableMissing(error)) return NextResponse.json({ error: 'Checklist table not added yet', tableMissing: true }, { status: 503 });
    console.error('manual ticks POST failed:', error);
    return NextResponse.json({ error: 'Could not tick' }, { status: 500 });
  }
  const { data: row } = await db.from('ops_checklist_ticks').select('task_key, period, period_start, done_by_name, done_at')
    .eq('task_key', key).eq('period', period).eq('period_start', periodStart).maybeSingle();
  return NextResponse.json({ ok: true, tick: row });
}
