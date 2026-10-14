-- 005_balanced_teams.sql
-- Balanced teams for a game, made by the C++ solver (services/teams-solver) through the
-- Grassroots API (services/calendar-feed).
--
--   users.skill_rating   each player's level, 1 (new) to 5 (very strong), set on the Profile
--                        screen. Empty means "not set"; the solver treats that as 3.
--   game_teams           which team each player is on for a game
--
-- Only the API writes game_teams (with the secret key), after checking the caller is the
-- game's organizer. Signed-in players can read it, so everyone in the game sees the teams.
-- Safe to run more than once.

alter table public.users add column if not exists skill_rating smallint;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_skill_rating_range') then
    alter table public.users add constraint users_skill_rating_range
      check (skill_rating between 1 and 5);
  end if;
end $$;

create table if not exists public.game_teams (
  game_id     uuid not null references public.games (game_id) on delete cascade,
  player_id   uuid not null references auth.users (id) on delete cascade,
  team        smallint not null check (team between 1 and 4),
  created_at  timestamptz not null default now(),
  primary key (game_id, player_id)
);

alter table public.game_teams enable row level security;

drop policy if exists "game_teams: signed-in users read" on public.game_teams;
create policy "game_teams: signed-in users read" on public.game_teams
  for select to authenticated using (true);

-- No insert/update/delete for app users: only the API, with the secret key, saves teams.
revoke insert, update, delete on public.game_teams from anon, authenticated;
revoke select on public.game_teams from anon;
grant select on public.game_teams to authenticated;
