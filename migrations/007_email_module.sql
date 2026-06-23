-- Phase 7: Single email, bulk email campaigns, templates, and SendGrid tracking.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'email_status') then
    create type public.email_status as enum ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed');
  end if;
end $$;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  subject text not null check (char_length(trim(subject)) between 1 and 200),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  subject text not null check (char_length(trim(subject)) between 1 and 200),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  total_recipients integer not null default 0 check (total_recipients >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  opened_count integer not null default 0 check (opened_count >= 0),
  clicked_count integer not null default 0 check (clicked_count >= 0),
  bounced_count integer not null default 0 check (bounced_count >= 0),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id uuid references public.email_campaigns(id) on delete set null,
  recipient_email text not null,
  subject text not null check (char_length(trim(subject)) between 1 and 200),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  status public.email_status not null default 'queued',
  provider_message_id text,
  error_message text,
  open_count integer not null default 0 check (open_count >= 0),
  click_count integer not null default 0 check (click_count >= 0),
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_templates_created_by_idx on public.email_templates (created_by);
create index if not exists email_campaigns_created_by_idx on public.email_campaigns (created_by);
create index if not exists email_logs_lead_id_created_at_idx on public.email_logs (lead_id, created_at desc);
create index if not exists email_logs_campaign_id_idx on public.email_logs (campaign_id);
create index if not exists email_logs_status_idx on public.email_logs (status);
create index if not exists email_logs_provider_message_id_idx on public.email_logs (provider_message_id);
create index if not exists email_logs_recipient_email_idx on public.email_logs (recipient_email);

drop trigger if exists set_email_templates_updated_at on public.email_templates;
create trigger set_email_templates_updated_at
before update on public.email_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_email_logs_updated_at on public.email_logs;
create trigger set_email_logs_updated_at
before update on public.email_logs
for each row execute function public.set_updated_at();

alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_logs enable row level security;

drop policy if exists "Users can read email templates" on public.email_templates;
create policy "Users can read email templates"
on public.email_templates
for select
to authenticated
using (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can create own email templates" on public.email_templates;
create policy "Users can create own email templates"
on public.email_templates
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Users can update own email templates" on public.email_templates;
create policy "Users can update own email templates"
on public.email_templates
for update
to authenticated
using (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'))
with check (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can read own email campaigns" on public.email_campaigns;
create policy "Users can read own email campaigns"
on public.email_campaigns
for select
to authenticated
using (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can create own email campaigns" on public.email_campaigns;
create policy "Users can create own email campaigns"
on public.email_campaigns
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Users can update own email campaigns" on public.email_campaigns;
create policy "Users can update own email campaigns"
on public.email_campaigns
for update
to authenticated
using (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'))
with check (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can read email logs for visible leads" on public.email_logs;
create policy "Users can read email logs for visible leads"
on public.email_logs
for select
to authenticated
using (
  created_by = auth.uid()
  or public.current_user_role() in ('super_admin', 'admin', 'manager')
  or exists (
    select 1
    from public.leads
    where leads.id = email_logs.lead_id
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

drop policy if exists "Users can create own email logs" on public.email_logs;
create policy "Users can create own email logs"
on public.email_logs
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Users can update own email logs" on public.email_logs;
create policy "Users can update own email logs"
on public.email_logs
for update
to authenticated
using (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'))
with check (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'));
