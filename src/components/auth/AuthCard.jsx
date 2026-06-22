export default function AuthCard({ title, subtitle, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Marketing CRM</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
