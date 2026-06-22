# Phase 4 Verification Checklist

## Functionality
- Lead profile shows a `Call` button with the lead phone number.
- Clicking `Call` creates a Twilio outbound call when Twilio env vars are configured.
- Call history displays date, duration, status, recording, and agent.
- Call notes can be saved after a call.
- Twilio status webhook updates call status and duration.
- Twilio recording webhook stores recording URL and duration.
- Twilio incoming webhook logs inbound calls and matches leads by phone number.
- Call events appear in the lead activity timeline.

## Database
- Run `migrations/004_twilio_calling.sql` after Phase 1, 2, and 3 migrations.
- Confirm `public.call_logs` exists with `id`, `lead_id`, `twilio_call_sid`, `direction`, `status`, `duration`, `recording_url`, `agent_id`, and `created_at`.
- Confirm `public.twilio_webhook_events` exists for webhook monitoring.
- Confirm call log indexes exist for lead, agent, status, and webhook SID.

## Security
- Confirm RLS is enabled on `call_logs` and `twilio_webhook_events`.
- Confirm users can read call logs only for visible leads or their own calls.
- Confirm users can create call logs only as themselves.
- Confirm Twilio credentials are only stored in `.env.local`.
- Confirm webhook routes validate `x-twilio-signature` when callback URLs are configured.
- `npm audit` still reports the known moderate Next.js nested PostCSS advisory from Phase 1.

## UI
- Verify `/leads/[id]` call section fits desktop and mobile widths.
- Verify missing Twilio env vars show an API error instead of exposing credentials.
- Verify call history empty state renders cleanly.
- Verify recording links open in a new tab when present.

## API
- `POST /api/calls/start` requires bearer-token authentication.
- `POST /api/calls/start` rejects invisible lead IDs.
- `GET /api/calls` returns paginated call history.
- `PATCH /api/calls/[id]/notes` validates and stores call notes.
- `POST /api/twilio/status` updates call status and records webhook events.
- `POST /api/twilio/recording` updates recording URL and records webhook events.
- `POST /api/twilio/incoming` logs incoming calls and returns TwiML.
