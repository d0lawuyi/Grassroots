-- 002_hidden_games.sql
-- Lets a player remove a played game (and its chat) from their own My Games and Chats.
-- It only hides the game for that one person: other players, ratings and stats are untouched.
-- Safe to run more than once.

do $$
declare
  game_id_type text;
begin
  -- Match whatever type games.game_id already uses (uuid, bigint, ...)
  select format_type(a.atttypid, a.atttypmod) into game_id_type
  from pg_attribute a
  where a.attrelid = 'public.games'::regclass
    and a.attname = 'game_id'
    and not a.attisdropped;

  if to_regclass('public.hidden_games') is null then
    execute format($f$
      create table public.hidden_games (
        user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
        game_id   %s   not null references public.games(game_id) on delete cascade,
        hidden_at timestamptz not null default now(),
        primary key (user_id, game_id)
      )$f$, game_id_type);
  end if;
end $$;

alter table public.hidden_games enable row level security;

drop policy if exists "hidden_games: read own"   on public.hidden_games;
drop policy if exists "hidden_games: add own"    on public.hidden_games;
drop policy if exists "hidden_games: remove own" on public.hidden_games;

create policy "hidden_games: read own" on public.hidden_games
  for select to authenticated using (user_id = auth.uid());

create policy "hidden_games: add own" on public.hidden_games
  for insert to authenticated with check (user_id = auth.uid());

create policy "hidden_games: remove own" on public.hidden_games
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.hidden_games to authenticated;
