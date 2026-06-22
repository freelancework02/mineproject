# Phase 1 Verification Checklist

## Functionality
- Login form validates email and password.
- Signup form validates name, email, and password.
- Authenticated users can access `/dashboard`.
- Unauthenticated users are redirected to `/login`.
- User menu can sign out.

## Database
- Run `migrations/001_initial_schema.sql` in Supabase SQL editor or migration tooling.
- Confirm `public.users` exists with `id`, `name`, `email`, `role`, `created_at`, and `updated_at`.
- Confirm `app_role` enum exists.
- Confirm `set_users_updated_at` trigger exists.

## Security
- Confirm RLS is enabled on `public.users`.
- Confirm authenticated users can read and update only their own profile by default.
- Confirm admin roles can read and update permitted profile data.
- Confirm service keys are only stored in `.env.local`, never in client code.
- `npm audit` reports a moderate advisory from Next.js' nested `postcss@8.4.31`; top-level `postcss` is pinned to `8.5.10+`, and Next 15.5.19/16.2.9 still pin the nested copy at the time of verification.

## UI
- Verify `/login`, `/signup`, and `/dashboard` render at desktop and mobile widths.
- Verify loading states, field errors, and API errors are visible.
- Verify dashboard layout contains sidebar, header, and user menu.

## API
- `GET /api/auth/me` returns `401` without a bearer token.
- `GET /api/auth/me` returns the authenticated Supabase user and profile with a valid token.
- `POST /api/auth/profile` validates input and upserts the authenticated user's profile.
