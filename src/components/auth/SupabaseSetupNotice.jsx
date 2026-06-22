export default function SupabaseSetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud px-4 py-10">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Environment setup required</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Connect Supabase to run the CRM</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Create a local environment file and add your Supabase project URL and anon key. Restart the dev server after
          changing environment variables.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-md bg-slate-950 p-4 text-sm text-white">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`}
        </pre>
        <p className="mt-4 text-sm text-slate-600">
          Keep the service role key server-side only. Do not expose it in browser code.
        </p>
      </section>
    </main>
  );
}
