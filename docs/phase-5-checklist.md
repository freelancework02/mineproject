# Phase 5 Verification Checklist

## Functionality
- Lead profile can send a single SMS to one lead.
- Lead profile shows SMS history with sent, delivered, failed, and undelivered statuses.
- `/sms` can create reusable SMS templates.
- `/sms` can apply a template to a bulk SMS campaign.
- `/sms` can send bulk SMS to filtered leads.
- `/sms` can send bulk SMS to uploaded CSV recipient lists.
- Twilio SMS status webhook updates delivery status.
- SMS events appear in the lead activity timeline.

## Database
- Run `migrations/005_sms_module.sql` after prior migrations.
- Confirm `public.sms_logs` exists with `id`, `lead_id`, `message`, `status`, `twilio_message_sid`, and `created_at`.
- Confirm `public.sms_templates` exists.
- Confirm `public.sms_campaigns` exists.
- Confirm indexes exist for lead SMS history, campaign logs, status, Twilio SID, and template/campaign creators.

## Security
- Confirm RLS is enabled on `sms_logs`, `sms_templates`, and `sms_campaigns`.
- Confirm SMS APIs require bearer-token authentication.
- Confirm SMS sending uses Twilio credentials only from server-side environment variables.
- Confirm SMS webhook validates `x-twilio-signature` when callback URL is configured.
- Confirm bulk SMS is capped to 250 filtered/uploaded recipients per request.
- `npm audit` still reports the known moderate Next.js nested PostCSS advisory from Phase 1.

## UI
- Verify `/sms` redirects unauthenticated users to `/login`.
- Verify missing Supabase env vars show the setup notice, not a runtime crash.
- Verify `/sms` layout fits desktop and mobile widths.
- Verify lead profile SMS form and SMS history fit desktop and mobile widths.

## API
- `POST /api/sms/send` sends one SMS to a visible lead.
- `POST /api/sms/bulk` sends SMS to filtered leads and uploaded recipients.
- `GET /api/sms/templates` returns visible templates.
- `POST /api/sms/templates` creates a reusable template.
- `GET /api/sms/logs` returns paginated SMS history.
- `POST /api/twilio/sms-status` updates SMS delivery status and records webhook events.
