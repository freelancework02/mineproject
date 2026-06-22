-- Phase 5: Single SMS, bulk SMS, templates, delivery tracking, and campaign batches.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sms_status') then
    create type public.sms_status as enum ('queued', 'sent', 'delivered', 'failed', 'undelivered');
  end if;
end $$;

create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  message text not null check (char_length(trim(message)) between 1 and 1600),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sms_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  message text not null check (char_length(trim(message)) between 1 and 1600),
  total_recipients integer not null default 0 check (total_recipients >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id uuid references public.sms_campaigns(id) on delete set null,
  message text not null check (char_length(trim(message)) between 1 and 1600),
  status public.sms_status not null default 'queued',
  twilio_message_sid text unique,
  error_message text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sms_logs_lead_id_created_at_idx on public.sms_logs (lead_id, created_at desc);
create index if not exists sms_logs_campaign_id_idx on public.sms_logs (campaign_id);
create index if not exists sms_logs_status_idx on public.sms_logs (status);
create index if not exists sms_logs_twilio_message_sid_idx on public.sms_logs (twilio_message_sid);
create index if not exists sms_templates_created_by_idx on public.sms_templates (created_by);
create index if not exists sms_campaigns_created_by_idx on public.sms_campaigns (created_by);

drop trigger if exists set_sms_logs_updated_at on public.sms_logs;
create trigger set_sms_logs_updated_at
before update on public.sms_logs
for each row execute function public.set_updated_at();

drop trigger if exists set_sms_templates_updated_at on public.sms_templates;
create trigger set_sms_templates_updated_at
before update on public.sms_templates
for each row execute function public.set_updated_at();

alter table public.sms_logs enable row level security;
alter table public.sms_templates enable row level security;
alter table public.sms_campaigns enable row level security;

drop policy if exists "Users can read SMS logs for visible leads" on public.sms_logs;
create policy "Users can read SMS logs for visible leads"
on public.sms_logs
for select
to authenticated
using (
  created_by = auth.uid()
  or public.current_user_role() in ('super_admin', 'admin', 'manager')
  or exists (
    select 1
    from public.leads
    where leads.id = sms_logs.lead_id
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

drop policy if exists "Users can create own SMS logs" on public.sms_logs;
create policy "Users can create own SMS logs"
on public.sms_logs
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Users can update own SMS logs" on public.sms_logs;
create policy "Users can update own SMS logs"
on public.sms_logs
for update
to authenticated
using (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'))
with check (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can read SMS templates" on public.sms_templates;
create policy "Users can read SMS templates"
on public.sms_templates
for select
to authenticated
using (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can create own SMS templates" on public.sms_templates;
create policy "Users can create own SMS templates"
on public.sms_templates
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Users can update own SMS templates" on public.sms_templates;
create policy "Users can update own SMS templates"
on public.sms_templates
for update
to authenticated
using (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'))
with check (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can read own SMS campaigns" on public.sms_campaigns;
create policy "Users can read own SMS campaigns"
on public.sms_campaigns
for select
to authenticated
using (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can create own SMS campaigns" on public.sms_campaigns;
create policy "Users can create own SMS campaigns"
on public.sms_campaigns
for insert
to authenticated
with check (created_by = auth.uid());
