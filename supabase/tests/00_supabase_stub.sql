-- 00_supabase_stub.sql
-- A tiny stand-in for the parts of Supabase the migrations rely on (auth schema,
-- roles, storage), so the migrations can be tested on a plain Postgres in CI.
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
grant usage on schema public to anon, authenticated;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;

-- Test helpers. Any failure raises an error, which stops psql and fails the CI job.
create or replace function public.t_expect_error(label text, q text, needle text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm ilike '%' || needle || '%' then
      raise notice 'PASS %: %', label, sqlerrm;
      return;
    end if;
    raise exception 'FAIL (wrong error) %: %', label, sqlerrm;
  end;
  raise exception 'FAIL (no error) %', label;
end $$;

create or replace function public.t_check(label text, ok boolean) returns void language plpgsql as $$
begin
  if ok then raise notice 'PASS %', label; else raise exception 'FAIL %', label; end if;
end $$;

grant execute on function public.t_expect_error(text, text, text), public.t_check(text, boolean) to authenticated;
