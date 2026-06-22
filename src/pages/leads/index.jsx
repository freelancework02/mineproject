import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SupabaseSetupNotice from "@/components/auth/SupabaseSetupNotice";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { LEAD_STATUS_OPTIONS } from "@/lib/leadConstants";
import { authApi } from "@/utils/api";

export default function LeadsPage() {
  const { configured, loading } = useProtectedRoute();
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    sortBy: "created_at",
    sortDirection: "desc"
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadLeads = useCallback(async (page = 1) => {
    setBusy(true);
    setError("");

    try {
      const client = await authApi();
      const { data } = await client.get("/api/leads", {
        params: {
          ...filters,
          status: filters.status || undefined,
          page,
          pageSize: pagination.pageSize
        }
      });
      setLeads(data.leads);
      setPagination(data.pagination);
    } catch (loadError) {
      setError(loadError.response?.data?.error || "Unable to load leads.");
    } finally {
      setBusy(false);
    }
  }, [filters, pagination.pageSize]);

  useEffect(() => {
    if (!configured || loading) return;
    loadLeads(1);
  }, [configured, loading, loadLeads]);

  if (!configured) return <SupabaseSetupNotice />;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cloud text-sm text-slate-600">
        Loading secure workspace...
      </main>
    );
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  return (
    <DashboardLayout>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">Lead management</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">Leads</h1>
          </div>
          <Link
            href="/leads/import"
            className="rounded-md bg-brand px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand/90"
          >
            Import leads
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_140px]">
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search name, email, or phone"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <select
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="">All statuses</option>
            {LEAD_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            value={filters.sortBy}
            onChange={(event) => updateFilter("sortBy", event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="created_at">Created date</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="source">Source</option>
          </select>
          <select
            value={filters.sortDirection}
            onChange={(event) => updateFilter("sortDirection", event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>

        {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-coral">{error}</p> : null}

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-brand hover:underline">
                      {lead.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{lead.phone}</td>
                  <td className="px-3 py-3 text-slate-700">{lead.email}</td>
                  <td className="px-3 py-3 text-slate-700">{lead.source}</td>
                  <td className="px-3 py-3">
                    <StatusPill status={lead.status} />
                  </td>
                  <td className="px-3 py-3 text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {!busy && leads.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-3 py-10 text-center text-slate-500">
                    No leads match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} leads
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadLeads(Math.max(1, pagination.page - 1))}
              disabled={busy || pagination.page <= 1}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => loadLeads(Math.min(pagination.totalPages, pagination.page + 1))}
              disabled={busy || pagination.page >= pagination.totalPages}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}

function StatusPill({ status }) {
  const label = LEAD_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;

  return <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-medium text-brand">{label}</span>;
}
