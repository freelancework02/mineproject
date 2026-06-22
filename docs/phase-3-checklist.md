# Phase 3 Verification Checklist

## Functionality
- `/leads` shows a protected lead list.
- Lead list supports search by name, email, or phone.
- Lead list supports status filtering.
- Lead list supports sorting by created date, name, status, and source.
- Lead list supports pagination with previous and next controls.
- `/leads/[id]` shows lead name, phone, email, source, owner, team, and status.
- Lead status can be changed to `New`, `Contacted`, `Interested`, `Follow Up`, `Won`, or `Lost`.
- Lead can be assigned to a visible user.
- Lead can be assigned to a visible team.
- Activity timeline displays status changes, assignments, notes, and future call/SMS/email/task events.
- Notes can be added to a lead timeline.

## Database
- Run `migrations/003_lead_management.sql` after Phase 1 and Phase 2 migrations.
- Confirm `public.lead_activities` exists with `id`, `lead_id`, `activity_type`, `activity_data`, `created_by`, and `created_at`.
- Confirm `public.teams` and `public.team_members` exist for team assignment.
- Confirm `public.leads.team_id` exists.
- Confirm indexes exist for lead status, lead created date, team assignment, and lead activity timeline.

## Security
- Confirm RLS is enabled on `teams`, `team_members`, and `lead_activities`.
- Confirm users can read activities only for visible leads.
- Confirm users can create activities only for visible leads and only as themselves.
- Confirm Phase 3 API routes require bearer-token authentication.
- Confirm lead update API allows only status, owner assignment, and team assignment fields.
- `npm audit` still reports the known moderate Next.js nested PostCSS advisory from Phase 1.

## UI
- Verify `/leads` and `/leads/[id]` redirect unauthenticated users to `/login`.
- Verify missing Supabase environment variables show the setup notice, not a runtime crash.
- Verify lead list table and filters fit desktop and mobile widths.
- Verify profile cards, assignment controls, note form, and timeline fit desktop and mobile widths.

## API
- `GET /api/leads` returns paginated results.
- `GET /api/leads` validates pagination, sorting, search, and status filters.
- `GET /api/leads/[id]` returns a single visible lead or `404`.
- `PATCH /api/leads/[id]` updates status or assignment and records timeline activity.
- `GET /api/leads/[id]/activities` returns newest activities first.
- `POST /api/leads/[id]/activities` creates a note activity.
- `GET /api/leads/assignees` returns visible users and teams.
