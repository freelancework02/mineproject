-- Phase 1: Project setup, authentication profile table, RBAC, and RLS.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('super_admin', 'admin', 'manager', 'agent');
  end if;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text not null unique,
  role public.app_role not null default 'agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

alter table public.users enable row level security;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

drop policy if exists "Users can read their own profile" on public.users;
create policy "Users can read their own profile"
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Admins can read all profiles" on public.users;
create policy "Admins can read all profiles"
on public.users
for select
to authenticated
using (public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
on public.users
for insert
to authenticated
with check (id = auth.uid() and role = 'agent');

drop policy if exists "Users can update their own basic profile" on public.users;
create policy "Users can update their own basic profile"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = (select role from public.users where id = auth.uid()));

drop policy if exists "Admins can update profile roles" on public.users;
create policy "Admins can update profile roles"
on public.users
for update
to authenticated
using (public.current_user_role() in ('super_admin', 'admin'))
with check (public.current_user_role() in ('super_admin', 'admin'));
