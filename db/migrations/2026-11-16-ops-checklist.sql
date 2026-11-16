-- Operating manual checklist ticks (Admin -> Operating manual; see lib/admin/manual/).
-- One row per ticked task per day / week / month, shared by everyone who works in the admin.
-- Unticking deletes the row. Safe to re-run. Service role only: RLS is on and there are no policies,
-- so anon/authenticated see nothing; the route app/api/admin/manual/ticks/route.ts reads and writes
-- with the service role after an admin check.
-- Until this is run, the manual page keeps ticks in the browser for the day and says so.
-- Rollback at the bottom (commented).

create table if not exists public.ops_checklist_ticks (
  id             uuid        primary key default gen_random_uuid(),
  task_key       text        not null,                         -- stable slug from lib/admin/manual/content.ts
  period         text        not null check (period in ('day', 'week', 'month')),
  period_start   date        not null,                         -- the day, the Monday of the week, or the 1st of the month (Europe/London)
  done_by        uuid,                                         -- auth user id of the admin who ticked it
  done_by_name   text,                                         -- first name, kept so the list reads "Done by Sam, 09:14"
  done_at        timestamptz not null default now(),
  constraint ops_checklist_ticks_unique unique (task_key, period, period_start)
);

create index if not exists ops_checklist_ticks_period_idx
  on public.ops_checklist_ticks (period, period_start);

alter table public.ops_checklist_ticks enable row level security;
-- (deliberately no policies)

-- Rollback:
-- drop table if exists public.ops_checklist_ticks;
