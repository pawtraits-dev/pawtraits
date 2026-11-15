-- CSP report-only trial: aggregated violation reports (see lib/security/csp-reports.ts).
-- Safe to re-run. Service role only: RLS is on and there are no policies, so anon/authenticated see nothing.
-- Rollback at the bottom (commented).

create table if not exists public.csp_reports (
  id                 bigint generated always as identity primary key,
  effective_directive text        not null,
  blocked            text        not null,   -- 'inline' | 'eval' | 'data' | ... or an origin like https://x.example (path stripped)
  document_path      text        not null,   -- page path, ids replaced by :id, no query string
  disposition        text        not null default 'report',
  count              bigint      not null default 1,
  first_seen         timestamptz not null default now(),
  last_seen          timestamptz not null default now(),
  sample             text,                   -- first script sample seen (<= 120 chars)
  source_file        text,                   -- origin + path only
  line_number        integer,
  user_agent_family  text
);

create unique index if not exists csp_reports_key_idx
  on public.csp_reports (effective_directive, blocked, document_path, disposition);

create index if not exists csp_reports_count_idx on public.csp_reports (count desc);

alter table public.csp_reports enable row level security;
-- (deliberately no policies)

-- Atomic upsert for a batch: p_rows = [{effective_directive, blocked, document_path, disposition, count, sample, source_file, line_number, user_agent_family}, ...]
-- New keys are refused once the table holds 5000 rows, so a flood of made-up reports cannot grow it without bound
-- (existing keys keep counting).
create or replace function public.csp_report_upsert(p_rows jsonb)
returns void
language plpgsql
as $$
declare
  r jsonb;
  total bigint;
begin
  for r in select * from jsonb_array_elements(p_rows) loop
    update public.csp_reports
       set count = count + coalesce((r->>'count')::bigint, 1),
           last_seen = now()
     where effective_directive = r->>'effective_directive'
       and blocked = r->>'blocked'
       and document_path = r->>'document_path'
       and disposition = r->>'disposition';
    if not found then
      select count(*) into total from public.csp_reports;
      if total < 5000 then
        insert into public.csp_reports
          (effective_directive, blocked, document_path, disposition, count, sample, source_file, line_number, user_agent_family)
        values
          (r->>'effective_directive', r->>'blocked', r->>'document_path', r->>'disposition',
           coalesce((r->>'count')::bigint, 1), left(r->>'sample', 120), left(r->>'source_file', 150),
           nullif(r->>'line_number', '')::integer, left(r->>'user_agent_family', 40))
        on conflict (effective_directive, blocked, document_path, disposition)
        do update set count = public.csp_reports.count + excluded.count, last_seen = now();
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.csp_report_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.csp_report_upsert(jsonb) to service_role;

-- Rollback:
-- drop function if exists public.csp_report_upsert(jsonb);
-- drop table if exists public.csp_reports;
