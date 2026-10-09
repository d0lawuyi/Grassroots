-- 01_app_tables.sql
-- The app's original tables (created in the Supabase dashboard before migrations
-- existed), trimmed to the columns the migrations and tests touch.

create table public.parks (
  park_id uuid primary key default gen_random_uuid(),
  name text not null,
  sports text[],
  hourly_rate numeric,
  latitude double precision,
  longitude double precision,
  status text not null default 'active' check (status in ('active', 'inactive'))
);
alter table public.parks enable row level security;
create policy "anyone reads parks" on public.parks for select using (true);
insert into public.parks (name, sports, hourly_rate, latitude, longitude) values ('Legacy Park', '{soccer}', 0, 39.8, -86.1);

create table public.users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text
);
alter table public.users enable row level security;
create policy "users read all" on public.users for select using (true);
create policy "users update self" on public.users for update using (user_id = auth.uid());

create table public.games (
  game_id uuid primary key default gen_random_uuid(),
  title text,
  sport text,
  park_id uuid references public.parks (park_id),
  organizer_id uuid references auth.users (id),
  start_time timestamptz,
  end_time timestamptz
);
alter table public.games enable row level security;
create policy "anyone reads games" on public.games for select using (true);

create table public.bookings (
  game_id uuid references public.games (game_id) on delete cascade,
  player_id uuid references auth.users (id),
  rating_given int,
  primary key (game_id, player_id)
);
alter table public.bookings enable row level security;
