-- 004_calendar_feeds.sql
-- A private calendar link for each venue owner, served by services/calendar-feed (C#).
--
--   calendar_feeds          one secret link (token) per owner
--   my_calendar_feed()      the signed-in owner's link, created the first time it's asked for
--   reset_calendar_feed()   gives the owner a new link; the old one stops working
--
-- The token is the only thing protecting the feed, so it's long (64 random hex
-- characters) and only its owner can read it. Safe to run more than once.

create table if not exists public.calendar_feeds (
  owner_id    uuid primary key references auth.users (id) on delete cascade,
  token       text not null unique
              default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at  timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

drop policy if exists "calendar_feeds: owner reads own" on public.calendar_feeds;
create policy "calendar_feeds: owner reads own" on public.calendar_feeds
  for select to authenticated using (owner_id = auth.uid());

-- No insert/update/delete policies: the two functions below are the only way in.
revoke insert, update, delete on public.calendar_feeds from anon, authenticated;
grant select on public.calendar_feeds to authenticated;

create or replace function public.my_calendar_feed()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to get your calendar link.';
  end if;
  insert into public.calendar_feeds (owner_id) values (auth.uid())
  on conflict (owner_id) do nothing;
  select token into t from public.calendar_feeds where owner_id = auth.uid();
  return t;
end $$;

create or replace function public.reset_calendar_feed()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to reset your calendar link.';
  end if;
  insert into public.calendar_feeds (owner_id) values (auth.uid())
  on conflict (owner_id) do update
    set token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), created_at = now()
  returning token into t;
  return t;
end $$;

revoke all on function public.my_calendar_feed(), public.reset_calendar_feed() from public;
grant execute on function public.my_calendar_feed(), public.reset_calendar_feed() to authenticated;
