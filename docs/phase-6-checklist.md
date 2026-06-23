# Phase 6 Verification Checklist

## Functionality
- `/twilio` shows Twilio account balance, active numbers, CRM call totals, and CRM SMS totals.
- `/twilio` displays purchased Twilio phone numbers when server credentials are configured.
- Admins can assign Twilio numbers to a user or team.
- Managers can view Twilio administration data without changing assignments.
- Call logs, SMS logs, recordings, and webhook events are visible from the Twilio admin page.
- The page shows a clear fallback when Twilio credentials are missing.

## Database
- Run `migrations/006_twilio_admin.sql` after prior migrations.
- Confirm `public.twilio_number_assignments` exists with user and team assignment columns.
- Confirm `public.twilio_usage_snapshots` exists for usage tracking snapshots.
- Confirm indexes exist for number assignment lookup and usage snapshot filtering.

## Security
- Confirm RLS is enabled on `twilio_number_assignments` and `twilio_usage_snapshots`.
- Confirm managers and admins can read Twilio assignment and usage data.
- Confirm only super admins and admins can change Twilio number assignments.
- Confirm Twilio admin APIs require bearer-token authentication.
- Confirm Twilio credentials remain server-side only.

## UI
- Verify `/twilio` redirects unauthenticated users to `/login`.
- Verify agents see a permission message instead of Twilio account data.
- Verify the phone number table and log panels fit desktop and mobile widths.
- Verify missing Supabase env vars show the setup notice, not a runtime crash.

## API
- `GET /api/twilio/admin/overview` returns account overview and local CRM stats.
- `GET /api/twilio/admin/numbers` returns purchased numbers, assignments, users, and teams.
- `POST /api/twilio/admin/numbers` upserts a number assignment for admins only.
- `GET /api/twilio/admin/logs` returns recent calls, SMS, recordings, and webhook events.
