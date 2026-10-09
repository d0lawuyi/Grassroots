-- Grassroots: venue owner submission -> admin verification -> verified listing
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to run again: every step checks whether it already exists.
--
-- What it adds:
--   admins               who can approve venues (you add yourself at the bottom)
--   venue_submissions    an owner's listing, from draft to approved
--   venue_checks         the four admin checks per submission
--   parks (new columns)  owner, verification and detail fields on live venues
--   storage buckets      venue-photos (public) and venue-proofs (private)
--   functions            is_admin(), admin_venue_queue(), review_venue_submission()

begin;

-- ---------------------------------------------------------------------------
-- 1. Admins
-- A separate table, not a column on users, so nobody can promote themselves
-- by editing their own profile row.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  added_at  timestamptz not null default now()
);

alter table public.admins enable row level security;

drop policy if exists "Admins can see their own admin row" on public.admins;
create policy "Admins can see their own admin row"
  on public.admins for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Venue submissions
-- ---------------------------------------------------------------------------
create table if not exists public.venue_submissions (
  submission_id  uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status         text not null default 'draft'
                 check (status in ('draft', 'submitted', 'changes_requested', 'approved', 'rejected')),

  name           text not null check (char_length(btrim(name)) between 2 and 80),
  sports         text[] not null default '{}',
  address        text,
  city           text,
  state          text,
  latitude       double precision check (latitude is null or latitude between -90 and 90),
  longitude      double precision check (longitude is null or longitude between -180 and 180),

  is_free        boolean not null default false,
  hourly_rate    numeric(8, 2) check (hourly_rate is null or hourly_rate >= 0),
  availability   text,

  surface        text,
  lights_until   text,
  parking        text,
  rules          text,

  photos         text[] not null default '{}',
  proof_path     text,

  admin_note     text,
  park_id        text,
  submitted_at   timestamptz,
  reviewed_at    timestamptz,
  reviewed_by    uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists venue_submissions_owner_idx  on public.venue_submissions (owner_id);
create index if not exists venue_submissions_status_idx on public.venue_submissions (status, submitted_at);

-- Owners may only edit drafts and listings sent back for changes, may only move
-- them to draft or submitted, and can never touch review fields. Admin decisions
-- go through review_venue_submission(), which runs as the database owner and so
-- skips this check.
create or replace function public.venue_submissions_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    if new.status not in ('draft', 'submitted') then
      raise exception 'New venues start as a draft or are submitted for review';
    end if;
  else
    if old.status not in ('draft', 'changes_requested') then
      raise exception 'This venue is % and can no longer be edited', replace(old.status, '_', ' ');
    end if;
    if new.status not in ('draft', 'submitted') then
      raise exception 'You can save a draft or submit for review';
    end if;
    if new.owner_id is distinct from old.owner_id then
      raise exception 'The owner of a listing cannot be changed';
    end if;
  end if;

  if tg_op = 'INSERT'
     or new.admin_note  is distinct from old.admin_note
     or new.park_id     is distinct from old.park_id
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by then
    if tg_op = 'INSERT' then
      new.admin_note := null; new.park_id := null; new.reviewed_at := null; new.reviewed_by := null;
    else
      raise exception 'Review fields are set by Grassroots admins only';
    end if;
  end if;

  if new.status = 'submitted' then
    if coalesce(array_length(new.sports, 1), 0) = 0 then
      raise exception 'Choose at least one sport';
    end if;
    if new.latitude is null or new.longitude is null then
      raise exception 'Set the venue location on the map';
    end if;
    if not new.is_free and coalesce(new.hourly_rate, 0) <= 0 then
      raise exception 'Enter an hourly rate, or mark the venue as free';
    end if;
    if coalesce(array_length(new.photos, 1), 0) = 0 then
      raise exception 'Add at least one photo of the field';
    end if;
    if new.proof_path is null then
      raise exception 'Add proof that you own or manage this venue';
    end if;
    new.submitted_at := now();
  end if;

  if new.is_free then
    new.hourly_rate := 0;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists venue_submissions_guard on public.venue_submissions;
create trigger venue_submissions_guard
  before insert or update on public.venue_submissions
  for each row execute function public.venue_submissions_guard();

alter table public.venue_submissions enable row level security;

drop policy if exists "Owners and admins can read submissions" on public.venue_submissions;
create policy "Owners and admins can read submissions"
  on public.venue_submissions for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "Owners can create submissions" on public.venue_submissions;
create policy "Owners can create submissions"
  on public.venue_submissions for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Owners can edit their submissions" on public.venue_submissions;
create policy "Owners can edit their submissions"
  on public.venue_submissions for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners can delete drafts" on public.venue_submissions;
create policy "Owners can delete drafts"
  on public.venue_submissions for delete to authenticated
  using (owner_id = auth.uid() and status = 'draft');

-- ---------------------------------------------------------------------------
-- 3. The four admin checks
-- ---------------------------------------------------------------------------
create table if not exists public.venue_checks (
  check_id       bigint generated always as identity primary key,
  submission_id  uuid not null references public.venue_submissions (submission_id) on delete cascade,
  check_name     text not null check (check_name in ('ownership', 'location', 'pricing', 'legitimacy')),
  result         text not null check (result in ('pass', 'flag')),
  note           text,
  checked_by     uuid references auth.users (id),
  checked_at     timestamptz not null default now(),
  unique (submission_id, check_name)
);

alter table public.venue_checks enable row level security;

drop policy if exists "Admins can read checks" on public.venue_checks;
create policy "Admins can read checks"
  on public.venue_checks for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. New columns on live venues (parks)
-- Existing parks keep working; verification_status stays empty for them, which
-- the app shows as "not yet verified".
-- ---------------------------------------------------------------------------
alter table public.parks add column if not exists owner_id            uuid references auth.users (id);
alter table public.parks add column if not exists verification_status text;
alter table public.parks add column if not exists verified_at         timestamptz;
alter table public.parks add column if not exists verified_by         uuid references auth.users (id);
alter table public.parks add column if not exists submission_id       uuid references public.venue_submissions (submission_id);
alter table public.parks add column if not exists address             text;
alter table public.parks add column if not exists city                text;
alter table public.parks add column if not exists state               text;
alter table public.parks add column if not exists photos              text[];
alter table public.parks add column if not exists availability        text;
alter table public.parks add column if not exists surface             text;
alter table public.parks add column if not exists lights_until        text;
alter table public.parks add column if not exists parking             text;
alter table public.parks add column if not exists rules               text;

-- Only Grassroots (through review_venue_submission or the SQL editor) can mark
-- a park verified or change who owns it. App users never can.
create or replace function public.parks_verification_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.verification_status is not null or new.verified_at is not null
       or new.verified_by is not null or new.owner_id is not null or new.submission_id is not null then
      raise exception 'Only Grassroots admins can verify venues';
    end if;
  elsif new.verification_status is distinct from old.verification_status
     or new.verified_at   is distinct from old.verified_at
     or new.verified_by   is distinct from old.verified_by
     or new.owner_id      is distinct from old.owner_id
     or new.submission_id is distinct from old.submission_id then
    raise exception 'Only Grassroots admins can verify venues';
  end if;
  return new;
end;
$$;

drop trigger if exists parks_verification_guard on public.parks;
create trigger parks_verification_guard
  before insert or update on public.parks
  for each row execute function public.parks_verification_guard();

-- ---------------------------------------------------------------------------
-- 5. Admin review queue
-- ---------------------------------------------------------------------------
create or replace function public.admin_venue_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only Grassroots admins can review venues' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row order by (row->>'sort_at') desc), '[]'::jsonb)
    into result
  from (
    select to_jsonb(s.*)
      || jsonb_build_object(
           'owner_email', u.email,
           'sort_at', coalesce(s.submitted_at, s.updated_at),
           'checks', coalesce((
             select jsonb_object_agg(c.check_name, jsonb_build_object('result', c.result, 'note', c.note))
             from public.venue_checks c
             where c.submission_id = s.submission_id
           ), '{}'::jsonb)
         ) as row
    from public.venue_submissions s
    join auth.users u on u.id = s.owner_id
    where s.status <> 'draft'
  ) q;

  return result;
end;
$$;

revoke all on function public.admin_venue_queue() from public;
grant execute on function public.admin_venue_queue() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Admin decision: approve, request changes or reject
-- Approving copies the listing into parks as a verified, active venue. Only the
-- columns your parks table actually has are filled, so this works with your
-- existing schema.
-- ---------------------------------------------------------------------------
create or replace function public.review_venue_submission(
  p_submission_id uuid,
  p_decision      text,
  p_note          text  default null,
  p_checks        jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s        public.venue_submissions;
  payload  jsonb;
  cols     text;
  new_park jsonb;
  passed   int;
begin
  if not public.is_admin() then
    raise exception 'Only Grassroots admins can review venues' using errcode = '42501';
  end if;

  if p_decision not in ('approve', 'request_changes', 'reject') then
    raise exception 'Decision must be approve, request_changes or reject';
  end if;

  select * into s from public.venue_submissions where submission_id = p_submission_id for update;
  if not found then
    raise exception 'Venue submission not found';
  end if;
  if s.status <> 'submitted' then
    raise exception 'This venue is %, not waiting for review', replace(s.status, '_', ' ');
  end if;

  if p_decision <> 'approve' and coalesce(btrim(p_note), '') = '' then
    raise exception 'Add a note telling the owner what to fix';
  end if;

  insert into public.venue_checks (submission_id, check_name, result, note, checked_by)
  select p_submission_id, key, value->>'result', nullif(btrim(value->>'note'), ''), auth.uid()
  from jsonb_each(coalesce(p_checks, '{}'::jsonb))
  on conflict (submission_id, check_name) do update
    set result = excluded.result, note = excluded.note,
        checked_by = excluded.checked_by, checked_at = now();

  if p_decision = 'approve' then
    select count(*) into passed
    from public.venue_checks
    where submission_id = p_submission_id and result = 'pass';
    if passed < 4 then
      raise exception 'All four checks must pass before approving';
    end if;

    payload := jsonb_build_object(
      'name',                btrim(s.name),
      'sports',              to_jsonb(s.sports),
      'hourly_rate',         case when s.is_free then 0 else s.hourly_rate end,
      'latitude',            s.latitude,
      'longitude',           s.longitude,
      'address',             s.address,
      'city',                s.city,
      'state',               s.state,
      'photos',              to_jsonb(s.photos),
      'availability',        s.availability,
      'surface',             s.surface,
      'lights_until',        s.lights_until,
      'parking',             s.parking,
      'rules',               s.rules,
      'status',              'active',
      'owner_id',            s.owner_id,
      'verification_status', 'approved',
      'verified_at',         now(),
      'verified_by',         auth.uid(),
      'submission_id',       s.submission_id
    );

    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
      into cols
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'parks' and payload ? c.column_name;

    execute format(
      'insert into public.parks (%1$s) select %1$s from jsonb_populate_record(null::public.parks, $1) returning to_jsonb(parks.*)',
      cols
    ) into new_park using payload;

    update public.venue_submissions
       set status = 'approved', park_id = new_park->>'park_id', admin_note = nullif(btrim(p_note), ''),
           reviewed_at = now(), reviewed_by = auth.uid()
     where submission_id = p_submission_id;

    return jsonb_build_object('status', 'approved', 'park', new_park);
  end if;

  update public.venue_submissions
     set status = case p_decision when 'reject' then 'rejected' else 'changes_requested' end,
         admin_note = btrim(p_note), reviewed_at = now(), reviewed_by = auth.uid()
   where submission_id = p_submission_id;

  return jsonb_build_object('status', case p_decision when 'reject' then 'rejected' else 'changes_requested' end);
end;
$$;

revoke all on function public.review_venue_submission(uuid, text, text, jsonb) from public;
grant execute on function public.review_venue_submission(uuid, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Photo storage
-- venue-photos: public, so Explore can show them. Owners upload into a folder
--               named with their user id.
-- venue-proofs: private. Only the owner and admins can open proof documents.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('venue-photos', 'venue-photos', true), ('venue-proofs', 'venue-proofs', false)
on conflict (id) do nothing;

drop policy if exists "Owners upload venue photos" on storage.objects;
create policy "Owners upload venue photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'venue-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners delete their venue photos" on storage.objects;
create policy "Owners delete their venue photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'venue-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners upload venue proofs" on storage.objects;
create policy "Owners upload venue proofs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'venue-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners and admins read venue proofs" on storage.objects;
create policy "Owners and admins read venue proofs"
  on storage.objects for select to authenticated
  using (bucket_id = 'venue-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

commit;

-- ---------------------------------------------------------------------------
-- LAST STEP: make yourself an admin. Replace the email with the one you sign
-- in to Grassroots with, then run just this line.
-- ---------------------------------------------------------------------------
-- insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
