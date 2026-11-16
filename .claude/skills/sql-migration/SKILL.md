---
name: sql-migration
description: How to write a Pawtraits database migration and the code that depends on it. The owner runs SQL by hand in Supabase; Claude never does. Use whenever a change needs a new table, column, index, function or seed data.
when_to_use: A feature needs to store something new; "add a column", "new table", "write the SQL".
paths: db/migrations/**
---

# Database migrations

Claude writes the file. The owner runs it in the Supabase SQL editor, sometimes days later, sometimes
out of order. Design for that.

## The file

- Path: `db/migrations/YYYY-MM-DD-short-name.sql` (today's date). Dated files are the current convention;
  the undated ones in that folder are old.
- Header comment: what it adds, which feature needs it, which earlier migrations it depends on, and that
  it is safe to run again. Copy the style of a recent one (`db/migrations/2026-11-16-preview-offers.sql`).
- **Safe to re-run:** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` before
  `CREATE POLICY`, `INSERT … ON CONFLICT DO NOTHING` for seeds. Wrap in `BEGIN; … COMMIT;` so a failure
  changes nothing.
- **Additive only.** No dropping or renaming columns the live code reads. A needed removal is a second,
  later migration after the code has stopped using it.
- New tables: primary key `uuid DEFAULT gen_random_uuid()`, `created_at timestamptz DEFAULT now()`, CHECK
  constraints for status-like text columns, lower-cased emails with a CHECK, indexes for the columns the
  code filters on. Row level security ON; if only server code uses it, no policies and
  `GRANT ALL … TO service_role`.
- A commented-out rollback block at the bottom.
- Confirm every existing table and column the migration references in `db/current-db/current-schema`
  and earlier migrations. If it depends on a table from another recent migration, say so in the header
  and in the report to the owner (a missing earlier migration is the usual cause of "relation does not exist").

## The code that depends on it

The site deploys before the SQL is run. So:

- Reads and writes of the new table or column must tolerate it not existing: catch the Postgres
  "undefined table / undefined column" errors and behave as if the feature is off. Copy the `MISSING`
  pattern in `lib/previews/server.ts`.
- Admin pages for the feature show one plain line naming the file to run.
- Existing features must behave exactly as before until the migration is run.
- Do not `select` a new column by name from an old table in a query that an existing feature depends on
  unless the failure is handled; a missing column fails the whole query.

## Telling the owner

In the report: the file's link on `main` (after merge), the order if there are several, what the site
does until it is run, and that it is safe to run twice. If he pastes an error, read it literally: it
almost always names the missing object.

After he confirms it ran, nothing else is needed; do not ask him to refresh a schema file. If a later
task relies on the new objects, read the migration file itself for the names.
