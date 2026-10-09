-- 003_python_tools.sql
-- Database pieces used by the Python tools in services/python.
--
--   venue_prechecks          results of the automatic admin pre-check, one row per submission
--   users.sideline_feature   a player's yes/no to being featured in The Sideline newsletter
--
-- The Python tools use the service role key, which skips row level security, so
-- the policies here only decide what the app (admins and players) can see.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Pre-check results
-- ---------------------------------------------------------------------------
create table if not exists public.venue_prechecks (
  submission_id  uuid primary key references public.venue_submissions (submission_id) on delete cascade,
  score          integer not null check (score between 0 and 100),
  -- [{"check": "location", "level": "flag" | "warn" | "ok", "message": "..."}]
  findings       jsonb not null default '[]'::jsonb,
  tool_version   text,
  checked_at     timestamptz not null default now()
);

alter table public.venue_prechecks enable row level security;

drop policy if exists "venue_prechecks: admins read" on public.venue_prechecks;
create policy "venue_prechecks: admins read" on public.venue_prechecks
  for select to authenticated using (public.is_admin());

grant select on public.venue_prechecks to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Sideline newsletter opt-in. Off by default: nobody is featured unless they say yes.
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists sideline_feature boolean not null default false;
