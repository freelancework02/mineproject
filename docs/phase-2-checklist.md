# Phase 2 Verification Checklist

## Functionality
- Upload a CSV file with `Name`, `Phone`, `Email`, and `Source` headers.
- Upload an XLSX file with `Name`, `Phone`, `Email`, and `Source` headers.
- Fetch a publicly viewable Google Sheet URL.
- Confirm empty email, invalid email, and invalid phone rows are marked invalid.
- Confirm duplicates are detected against existing `leads.email_normalized` and `leads.phone_normalized`.
- Confirm duplicate rows show `Skip Duplicate`, `Import Anyway`, and `Cancel Import`.

## Database
- Run `migrations/002_leads.sql` after `migrations/001_initial_schema.sql`.
- Confirm `public.leads` exists with normalized generated email and phone columns.
- Confirm `public.lead_imports` records each import summary.
- Confirm `set_leads_updated_at` trigger exists.
- Confirm indexes exist for normalized email, normalized phone, owner, and import creator.

## Security
- Confirm RLS is enabled on `public.leads` and `public.lead_imports`.
- Confirm users can insert only leads owned by their authenticated user id.
- Confirm managers/admins can read broader lead/import records through role policies.
- Confirm all Phase 2 API routes require bearer-token authentication.
- Confirm server recomputes validation and duplicate detection during final import.
- `npm audit` still reports the known moderate Next.js nested PostCSS advisory from Phase 1.

## UI
- Verify `/leads/import` redirects unauthenticated users to `/login`.
- Verify upload, Google Sheet import, duplicate review, invalid rows, and summary counters fit desktop and mobile widths.
- Verify cancel clears the active import.
- Verify import success clears the review table and shows imported/skipped counts.

## API
- `POST /api/leads/preview` returns `401` without a bearer token.
- `POST /api/leads/preview` rejects empty or oversized imports.
- `POST /api/leads/google-sheet` rejects non-Google-Sheets URLs.
- `POST /api/leads/import` creates `leads` rows and a `lead_imports` summary for valid records.
- `POST /api/leads/import` skips duplicate rows unless the row action is `import`.
