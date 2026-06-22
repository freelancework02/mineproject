-- Phase 6: Twilio administration metadata for number assignment.

create table if not exists public.twilio_number_assignments (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  assigned_user_id uuid references public.users(id) on delete set null,
  assigned_team_id uuid references public.teams(id) on delete set null,
  friendly_name text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists twilio_number_assignments_user_idx on public.twilio_number_assignments (assigned_user_id);
create index if not exists twilio_number_assignments_team_idx on public.twilio_number_assignments (assigned_team_id);

drop trigger if exists set_twilio_number_assignments_updated_at on public.twilio_number_assignments;
create trigger set_twilio_number_assignments_updated_at
before update on public.twilio_number_assignments
for each row execute function public.set_updated_at();

alter table public.twilio_number_assignments enable row level security;

drop policy if exists "Managers and admins can read Twilio number assignments" on public.twilio_number_assignments;
create policy "Managers and admins can read Twilio number assignments"
on public.twilio_number_assignments
for select
to authenticated
using (public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Admins can manage Twilio number assignments" on public.twilio_number_assignments;
create policy "Admins can manage Twilio number assignments"
on public.twilio_number_assignments
for all
to authenticated
using (public.current_user_role() in ('super_admin', 'admin'))
with check (public.current_user_role() in ('super_admin', 'admin'));
