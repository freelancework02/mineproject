# Phase 7 Verification Checklist

## Functionality
- Lead profile can send a single email to one lead.
- Lead profile shows email history with sent, delivered, opened, clicked, bounced, and failed statuses.
- `/email` can create reusable email templates.
- `/email` can apply a template to a bulk email campaign.
- `/email` can send bulk email to filtered leads.
- `/email` can send bulk email to uploaded CSV recipient lists.
- SendGrid event webhook updates delivery, open, click, bounce, and failure status.
- Email events appear in the lead activity timeline.

## Database
- Run `migrations/007_email_module.sql` after prior migrations.
- Confirm `public.email_logs` exists with `id`, `lead_id`, `subject`, `status`, `provider_message_id`, and `created_at`.
- Confirm `public.email_templates` exists.
- Confirm `public.email_campaigns` exists.
- Confirm indexes exist for lead email history, campaign logs, status, provider message ID, and template/campaign creators.

## Security
- Confirm RLS is enabled on `email_logs`, `email_templates`, and `email_campaigns`.
- Confirm email APIs require bearer-token authentication.
- Confirm SendGrid credentials are only read from server-side environment variables.
- Confirm the SendGrid webhook validates `x-crm-webhook-secret` when `SENDGRID_WEBHOOK_SECRET` is configured.
- Confirm bulk email is capped to 250 filtered/uploaded recipients per request.

## UI
- Verify `/email` redirects unauthenticated users to `/login`.
- Verify missing Supabase env vars show the setup notice, not a runtime crash.
- Verify `/email` layout fits desktop and mobile widths.
- Verify lead profile email form and email history fit desktop and mobile widths.

## API
- `POST /api/email/send` sends one email to a visible lead.
- `POST /api/email/bulk` sends email to filtered leads and uploaded recipients.
- `GET /api/email/templates` returns visible templates.
- `POST /api/email/templates` creates a reusable template.
- `GET /api/email/logs` returns paginated email history.
- `POST /api/sendgrid/events` updates email tracking status and records lead activities.
