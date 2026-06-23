-- Phase 8: Structured notes, tasks, reminders, and task lifecycle.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('pending', 'in_progress', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_type') then
    create type public.task_type as enum ('call_customer', 'follow_up', 'send_email', 'meeting');
  end if;
end $$;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 200),
  task_type public.task_type not null default 'follow_up',
  status public.task_status not null default 'pending',
  due_at timestamptz,
  reminder_at timestamptz,
  assigned_to uuid references public.users(id) on delete set null,
  created_by uuid not null references public.users(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_lead_id_created_at_idx on public.notes (lead_id, created_at desc);
create index if not exists notes_created_by_idx on public.notes (created_by);
create index if not exists tasks_lead_id_due_at_idx on public.tasks (lead_id, due_at asc);
create index if not exists tasks_assigned_to_status_due_at_idx on public.tasks (assigned_to, status, due_at asc);
create index if not exists tasks_created_by_idx on public.tasks (created_by);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_reminder_at_idx on public.tasks (reminder_at asc);

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "Users can read notes for visible leads" on public.notes;
create policy "Users can read notes for visible leads"
on public.notes
for select
to authenticated
using (
  created_by = auth.uid()
  or public.current_user_role() in ('super_admin', 'admin', 'manager')
  or exists (
    select 1
    from public.leads
    where leads.id = notes.lead_id
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

drop policy if exists "Users can create notes for visible leads" on public.notes;
create policy "Users can create notes for visible leads"
on public.notes
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.leads
    where leads.id = notes.lead_id
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

drop policy if exists "Users can update own notes" on public.notes;
create policy "Users can update own notes"
on public.notes
for update
to authenticated
using (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'))
with check (created_by = auth.uid() or public.current_user_role() in ('super_admin', 'admin', 'manager'));

drop policy if exists "Users can read visible tasks" on public.tasks;
create policy "Users can read visible tasks"
on public.tasks
for select
to authenticated
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.current_user_role() in ('super_admin', 'admin', 'manager')
  or exists (
    select 1
    from public.leads
    where leads.id = tasks.lead_id
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

drop policy if exists "Users can create visible tasks" on public.tasks;
create policy "Users can create visible tasks"
on public.tasks
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    lead_id is null
    or exists (
      select 1
      from public.leads
      where leads.id = tasks.lead_id
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

drop policy if exists "Users can update visible tasks" on public.tasks;
create policy "Users can update visible tasks"
on public.tasks
for update
to authenticated
using (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.current_user_role() in ('super_admin', 'admin', 'manager')
)
with check (
  assigned_to = auth.uid()
  or created_by = auth.uid()
  or public.current_user_role() in ('super_admin', 'admin', 'manager')
);
