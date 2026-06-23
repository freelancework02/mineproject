# Phase 8 Verification Checklist

## Functionality
- Lead profile can create unlimited structured notes.
- Lead profile displays note history with author and timestamp.
- Lead profile can create tasks for Call Customer, Follow Up, Send Email, and Meeting.
- Lead profile can update task status to Pending, In Progress, or Completed.
- `/tasks` displays assigned and visible tasks.
- `/tasks` highlights due reminders and overdue tasks.
- Task and note events appear in the lead activity timeline.

## Database
- Run `migrations/008_notes_tasks.sql` after prior migrations.
- Confirm `public.notes` exists with lead, body, creator, and timestamp fields.
- Confirm `public.tasks` exists with task type, status, due date, reminder date, assignee, and completion fields.
- Confirm indexes exist for lead notes, assigned tasks, task status, and reminder lookups.

## Security
- Confirm RLS is enabled on `notes` and `tasks`.
- Confirm users can read notes and tasks for visible leads.
- Confirm users can create notes and tasks only as themselves.
- Confirm task updates are restricted to assignees, creators, managers, admins, and super admins.
- Confirm notes and tasks APIs require bearer-token authentication.

## UI
- Verify `/tasks` redirects unauthenticated users to `/login`.
- Verify lead profile notes and task panels fit desktop and mobile widths.
- Verify `/tasks` filters fit desktop and mobile widths.
- Verify reminder and overdue labels remain readable.

## API
- `GET /api/notes` returns paginated visible notes.
- `POST /api/notes` creates a note for a visible lead.
- `GET /api/tasks` returns paginated visible tasks.
- `POST /api/tasks` creates a task.
- `PATCH /api/tasks/[id]` updates status, assignment, due date, reminder date, and title.
