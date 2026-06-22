-- Phase 3: Lead management, assignment, and activity timeline.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_activity_type') then
    create type public.lead_activity_type as enum ('call', 'sms', 'email', 'note', 'task', 'status', 'assignment', 'import');
  end if;
end $$;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 120),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table public.leads
add column if not exists team_id uuid references public.teams(id) on delete set null;

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type public.lead_activity_type not null,
  activity_data jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists leads_team_id_idx on public.leads (team_id);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists lead_activities_lead_id_created_at_idx on public.lead_activities (lead_id, created_at desc);
create index if not exists team_members_user_id_idx on public.team_members (user_id);

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.lead_activities enable row level security;

drop policy if exists "Authenticated users can read teams" on public.teams;
create policy "Authenticated users can read teams"
on public.teams
for select
to authenticated
using (true);

drop policy if exists "Managers and admins can create teams" on public.teams;
create policy "Managers and admins can create teams"
on public.teams
for insert
to authenticated
with check (created_by = auth.uid() and public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Managers and admins can update teams" on public.teams;
create policy "Managers and admins can update teams"
on public.teams
for update
to authenticated
using (public.current_user_role() in ('super_admin', 'admin', 'manager'))
with check (public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Authenticated users can read team members" on public.team_members;
create policy "Authenticated users can read team members"
on public.team_members
for select
to authenticated
using (true);

drop policy if exists "Managers and admins can manage team members" on public.team_members;
create policy "Managers and admins can manage team members"
on public.team_members
for all
to authenticated
using (public.current_user_role() in ('super_admin', 'admin', 'manager'))
with check (public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can read activities for visible leads" on public.lead_activities;
create policy "Users can read activities for visible leads"
on public.lead_activities
for select
to authenticated
using (
  exists (
    select 1
    from public.leads
    where leads.id = lead_activities.lead_id
      and (
        leads.owner_id = auth.uid()
        or public.current_user_role() in ('super_admin', 'admin', 'manager')
        or exists (
          select 1
          from public.team_members
          where team_members.team_id = leads.team_id
            and team_members.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Users can create activities for visible leads" on public.lead_activities;
create policy "Users can create activities for visible leads"
on public.lead_activities
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = lead_activities.lead_id
      and (
        leads.owner_id = auth.uid()
        or public.current_user_role() in ('super_admin', 'admin', 'manager')
        or exists (
          select 1
          from public.team_members
          where team_members.team_id = leads.team_id
            and team_members.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Users can read team assigned leads" on public.leads;
create policy "Users can read team assigned leads"
on public.leads
for select
to authenticated
using (
  exists (
    select 1
    from public.team_members
    where team_members.team_id = leads.team_id
      and team_members.user_id = auth.uid()
  )
);

drop policy if exists "Users can update team assigned leads" on public.leads;
create policy "Users can update team assigned leads"
on public.leads
for update
to authenticated
using (
  exists (
    select 1
    from public.team_members
    where team_members.team_id = leads.team_id
      and team_members.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.team_members
    where team_members.team_id = leads.team_id
      and team_members.user_id = auth.uid()
  )
);
