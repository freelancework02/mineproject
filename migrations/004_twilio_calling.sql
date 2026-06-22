-- Phase 4: Twilio calling, call logs, recordings, notes, and webhook monitoring.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'call_direction') then
    create type public.call_direction as enum ('incoming', 'outgoing');
  end if;

  if not exists (select 1 from pg_type where typname = 'call_status') then
    create type public.call_status as enum ('queued', 'ringing', 'in_progress', 'completed', 'busy', 'failed', 'no_answer', 'canceled');
  end if;
end $$;

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  twilio_call_sid text unique,
  direction public.call_direction not null,
  status public.call_status not null default 'queued',
  duration integer not null default 0 check (duration >= 0),
  recording_url text,
  notes text,
  agent_id uuid references public.users(id) on delete set null,
  from_number text,
  to_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.twilio_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  twilio_sid text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists call_logs_lead_id_created_at_idx on public.call_logs (lead_id, created_at desc);
create index if not exists call_logs_agent_id_created_at_idx on public.call_logs (agent_id, created_at desc);
create index if not exists call_logs_status_idx on public.call_logs (status);
create index if not exists twilio_webhook_events_twilio_sid_idx on public.twilio_webhook_events (twilio_sid);

drop trigger if exists set_call_logs_updated_at on public.call_logs;
create trigger set_call_logs_updated_at
before update on public.call_logs
for each row execute function public.set_updated_at();

alter table public.call_logs enable row level security;
alter table public.twilio_webhook_events enable row level security;

drop policy if exists "Users can read calls for visible leads" on public.call_logs;
create policy "Users can read calls for visible leads"
on public.call_logs
for select
to authenticated
using (
  agent_id = auth.uid()
  or public.current_user_role() in ('super_admin', 'admin', 'manager')
  or exists (
    select 1
    from public.leads
    where leads.id = call_logs.lead_id
      and (
        leads.owner_id = auth.uid()
        or exists (
          select 1
          from public.team_members
          where team_members.team_id = leads.team_id
            and team_members.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Users can create own call logs" on public.call_logs;
create policy "Users can create own call logs"
on public.call_logs
for insert
to authenticated
with check (
  agent_id = auth.uid()
  and (
    lead_id is null
    or exists (
      select 1
      from public.leads
      where leads.id = call_logs.lead_id
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
  )
);

drop policy if exists "Users can update own visible call logs" on public.call_logs;
create policy "Users can update own visible call logs"
on public.call_logs
for update
to authenticated
using (
  agent_id = auth.uid()
  or public.current_user_role() in ('super_admin', 'admin', 'manager')
)
with check (
  agent_id = auth.uid()
  or public.current_user_role() in ('super_admin', 'admin', 'manager')
);

drop policy if exists "Admins can read Twilio webhook events" on public.twilio_webhook_events;
create policy "Admins can read Twilio webhook events"
on public.twilio_webhook_events
for select
to authenticated
using (public.current_user_role() in ('super_admin', 'admin'));
