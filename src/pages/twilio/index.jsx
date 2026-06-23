import { useEffect, useMemo, useState } from "react";
import SupabaseSetupNotice from "@/components/auth/SupabaseSetupNotice";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { authApi } from "@/utils/api";

const ADMIN_ROLES = new Set(["super_admin", "admin"]);
const READ_ROLES = new Set(["super_admin", "admin", "manager"]);

export default function TwilioAdminPage() {
  const { configured, loading, profile } = useProtectedRoute();
  const [overview, setOverview] = useState(null);
  const [numbers, setNumbers] = useState({ purchasedNumbers: [], assignments: [], users: [], teams: [] });
  const [logs, setLogs] = useState({ calls: [], sms: [], recordings: [], webhooks: [] });
  const [assignmentForm, setAssignmentForm] = useState({
    phoneNumber: "",
    assignedUserId: "",
    assignedTeamId: "",
    friendlyName: ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = ADMIN_ROLES.has(profile?.role);
  const canRead = READ_ROLES.has(profile?.role);
  const assignmentByNumber = useMemo(
    () => new Map(numbers.assignments.map((assignment) => [assignment.phone_number, assignment])),
    [numbers.assignments]
  );

  useEffect(() => {
    if (!configured || loading || !profile || !canRead) return;
    loadTwilioAdmin();
  }, [configured, loading, profile, canRead]);

  if (!configured) return <SupabaseSetupNotice />;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cloud text-sm text-slate-600">
        Loading secure workspace...
      </main>
    );
  }

  if (!canRead) {
    return (
      <DashboardLayout>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-coral">You do not have permission to access Twilio administration.</p>
      </DashboardLayout>
    );
  }

  async function loadTwilioAdmin() {
    setError("");

    try {
      const client = await authApi();
      const [overviewResponse, numbersResponse, logsResponse] = await Promise.all([
        client.get("/api/twilio/admin/overview"),
        client.get("/api/twilio/admin/numbers"),
        client.get("/api/twilio/admin/logs")
      ]);
      setOverview(overviewResponse.data);
      setNumbers(numbersResponse.data);
      setLogs(logsResponse.data);
    } catch (loadError) {
      setError(loadError.response?.data?.error || "Unable to load Twilio administration data.");
    }
  }

  async function saveAssignment(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      await client.post("/api/twilio/admin/numbers", {
        phoneNumber: assignmentForm.phoneNumber,
        assignedUserId: assignmentForm.assignedUserId || null,
        assignedTeamId: assignmentForm.assignedTeamId || null,
        friendlyName: assignmentForm.friendlyName || null
      });
      setAssignmentForm({ phoneNumber: "", assignedUserId: "", assignedTeamId: "", friendlyName: "" });
      await loadTwilioAdmin();
      setNotice("Twilio number assignment saved.");
    } catch (saveError) {
      setError(saveError.response?.data?.error || "Unable to save Twilio number assignment.");
    } finally {
      setBusy(false);
    }
  }

  function startAssignment(phoneNumber, friendlyName = "") {
    const assignment = assignmentByNumber.get(phoneNumber);
    setAssignmentForm({
      phoneNumber,
      assignedUserId: assignment?.assigned_user_id || "",
      assignedTeamId: assignment?.assigned_team_id || "",
      friendlyName: assignment?.friendly_name || friendlyName || ""
    });
  }

  return (
    <DashboardLayout>
      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-coral">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Twilio Administration</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Account operations</h1>
      </div>

      {!overview?.configured ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Twilio credentials are not configured. Local CRM logs and assignments are still available.
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Balance" value={overview?.balance ? `${overview.balance.amount} ${overview.balance.currency}` : "Not available"} />
        <Metric label="Active Numbers" value={overview?.activeNumbers ?? 0} />
        <Metric label="CRM Calls" value={overview?.localStats?.totalCalls ?? 0} />
        <Metric label="CRM SMS" value={overview?.localStats?.totalSms ?? 0} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Phone numbers</h2>
            <button type="button" onClick={loadTwilioAdmin} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink">
              Refresh
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Number</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Assigned To</th>
                  <th className="px-3 py-2">Capabilities</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {numbers.purchasedNumbers.map((number) => {
                  const assignment = assignmentByNumber.get(number.phoneNumber);
                  return (
                    <tr key={number.sid}>
                      <td className="px-3 py-3 font-medium text-ink">{number.phoneNumber}</td>
                      <td className="px-3 py-3 text-slate-600">{assignment?.friendly_name || number.friendlyName || "Unlabeled"}</td>
                      <td className="px-3 py-3 text-slate-600">{assignment?.user?.name || assignment?.team?.name || "Unassigned"}</td>
                      <td className="px-3 py-3 text-slate-600">{formatCapabilities(number.capabilities)}</td>
                      <td className="px-3 py-3 text-right">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => startAssignment(number.phoneNumber, number.friendlyName)}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink"
                          >
                            Assign
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {numbers.purchasedNumbers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No purchased numbers loaded.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Number assignment</h2>
          {canManage ? (
            <form className="mt-4 space-y-3" onSubmit={saveAssignment}>
              <input
                value={assignmentForm.phoneNumber}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="+15551234567"
              />
              <input
                value={assignmentForm.friendlyName}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, friendlyName: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="Sales main line"
              />
              <select
                value={assignmentForm.assignedUserId}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, assignedUserId: event.target.value, assignedTeamId: "" }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Assign to user</option>
                {numbers.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
              <select
                value={assignmentForm.assignedTeamId}
                onChange={(event) => setAssignmentForm((current) => ({ ...current, assignedTeamId: event.target.value, assignedUserId: "" }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Assign to team</option>
                {numbers.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy || !assignmentForm.phoneNumber.trim()}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Save Assignment
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Managers can review assignments. Admins can change them.</p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">This month usage</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(overview?.usage || []).map((record) => (
            <article key={`${record.category}-${record.description}`} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-ink">{record.description || record.category}</p>
              <p className="mt-1 text-sm text-slate-600">
                {record.count || 0} {record.countUnit || "units"} {record.price ? `- ${record.price} ${record.priceUnit || ""}` : ""}
              </p>
            </article>
          ))}
        </div>
        {(overview?.usage || []).length === 0 ? <p className="mt-4 text-sm text-slate-500">No usage records loaded.</p> : null}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <LogList title="Recent calls" rows={logs.calls} render={(row) => `${row.direction} - ${row.status} - ${row.to_number || row.from_number || "No number"}`} />
        <LogList title="Recent SMS" rows={logs.sms} render={(row) => `${row.status} - ${row.message}`} />
        <LogList title="Recordings" rows={logs.recordings} render={(row) => `${row.duration || 0}s - ${row.recording_url}`} />
        <LogList title="Webhook events" rows={logs.webhooks} render={(row) => `${row.event_type} - ${row.processed ? "processed" : "pending"}${row.error_message ? ` - ${row.error_message}` : ""}`} />
      </section>
    </DashboardLayout>
  );
}

function Metric({ label, value }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </article>
  );
}

function LogList({ title, rows, render }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-slate-200 p-3">
            <p className="truncate text-sm text-slate-700">{render(row)}</p>
            <p className="mt-1 text-xs text-slate-500">{formatDate(row.created_at)}</p>
          </div>
        ))}
        {rows.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No records yet.</p> : null}
      </div>
    </article>
  );
}

function formatCapabilities(capabilities = {}) {
  return Object.entries(capabilities)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key.toUpperCase())
    .join(", ");
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
