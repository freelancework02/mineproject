import SupabaseSetupNotice from "@/components/auth/SupabaseSetupNotice";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";

export default function DashboardPage() {
  const { configured, loading, profile } = useProtectedRoute();

  if (!configured) {
    return <SupabaseSetupNotice />;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cloud text-sm text-slate-600">
        Loading secure workspace...
      </main>
    );
  }

  return (
    <DashboardLayout>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Leads" value="Phase 3" description="Lead list and profile management are active." />
        <Metric title="Calls" value="Phase 4" description="Click-to-call and call history are active." />
        <Metric title="SMS" value="Phase 5" description="Single and bulk SMS are active." />
        <Metric title="Email" value="Phase 7" description="SendGrid wiring comes later." />
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Phase 1 foundation</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          Welcome{profile?.name ? `, ${profile.name}` : ""}.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Authentication, lead imports, lead management, Twilio calling, and SMS messaging foundations are ready. The
          next phase starts only after you explicitly send START PHASE.
        </p>
      </section>
    </DashboardLayout>
  );
}

function Metric({ title, value, description }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </article>
  );
}
