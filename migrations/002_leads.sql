-- Phase 2: Lead import system, duplicate detection support, and import audit records.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type public.lead_status as enum ('new', 'contacted', 'interested', 'follow_up', 'won', 'lost');
  end if;
end $$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  email text not null check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  email_normalized text generated always as (lower(email)) stored,
  phone text not null check (phone ~ '^\+?[0-9][0-9 ()-]{6,20}$'),
  phone_normalized text generated always as (regexp_replace(phone, '[^0-9+]', '', 'g')) stored,
  source text not null default 'Import',
  status public.lead_status not null default 'new',
  owner_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  total_records integer not null default 0 check (total_records >= 0),
  duplicate_records integer not null default 0 check (duplicate_records >= 0),
  imported_records integer not null default 0 check (imported_records >= 0),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists leads_email_normalized_idx on public.leads (email_normalized);
create index if not exists leads_phone_normalized_idx on public.leads (phone_normalized);
create index if not exists leads_owner_id_idx on public.leads (owner_id);
create index if not exists lead_imports_created_by_idx on public.lead_imports (created_by);

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
alter table public.lead_imports enable row level security;

drop policy if exists "Users can read owned leads" on public.leads;
create policy "Users can read owned leads"
on public.leads
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "Managers and admins can read all leads" on public.leads;
create policy "Managers and admins can read all leads"
on public.leads
for select
to authenticated
using (public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can create owned leads" on public.leads;
create policy "Users can create owned leads"
on public.leads
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Users can update owned leads" on public.leads;
create policy "Users can update owned leads"
on public.leads
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Admins can update all leads" on public.leads;
create policy "Admins can update all leads"
on public.leads
for update
to authenticated
using (public.current_user_role() in ('super_admin', 'admin', 'manager'))
with check (public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can read own lead imports" on public.lead_imports;
create policy "Users can read own lead imports"
on public.lead_imports
for select
to authenticated
using (created_by = auth.uid());

drop policy if exists "Managers and admins can read all lead imports" on public.lead_imports;
create policy "Managers and admins can read all lead imports"
on public.lead_imports
for select
to authenticated
using (public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can create own lead imports" on public.lead_imports;
create policy "Users can create own lead imports"
on public.lead_imports
for insert
to authenticated
with check (created_by = auth.uid());
