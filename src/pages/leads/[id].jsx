import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import SupabaseSetupNotice from "@/components/auth/SupabaseSetupNotice";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { LEAD_STATUS_OPTIONS } from "@/lib/leadConstants";
import { TASK_STATUS_OPTIONS, TASK_TYPE_OPTIONS } from "@/lib/taskConstants";
import { authApi } from "@/utils/api";

export default function LeadProfilePage() {
  const router = useRouter();
  const { configured, loading } = useProtectedRoute();
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [calls, setCalls] = useState([]);
  const [smsLogs, setSmsLogs] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [assignees, setAssignees] = useState({ users: [], teams: [] });
  const [note, setNote] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", taskType: "follow_up", dueAt: "", reminderAt: "", assignedTo: "" });
  const [smsMessage, setSmsMessage] = useState("");
  const [emailForm, setEmailForm] = useState({ subject: "", body: "" });
  const [callNotes, setCallNotes] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const leadId = typeof router.query.id === "string" ? router.query.id : "";

  const loadActivities = useCallback(async () => {
    if (!leadId) return;
    const client = await authApi();
    const { data } = await client.get(`/api/leads/${leadId}/activities`);
    setActivities(data.activities);
  }, [leadId]);

  const loadCalls = useCallback(async () => {
    if (!leadId) return;
    const client = await authApi();
    const { data } = await client.get("/api/calls", {
      params: {
        leadId,
        pageSize: 20
      }
    });
    setCalls(data.calls);
    setCallNotes(Object.fromEntries(data.calls.map((call) => [call.id, call.notes || ""])));
  }, [leadId]);

  const loadSmsLogs = useCallback(async () => {
    if (!leadId) return;
    const client = await authApi();
    const { data } = await client.get("/api/sms/logs", {
      params: {
        leadId,
        pageSize: 20
      }
    });
    setSmsLogs(data.logs);
  }, [leadId]);

  const loadEmailLogs = useCallback(async () => {
    if (!leadId) return;
    const client = await authApi();
    const { data } = await client.get("/api/email/logs", {
      params: {
        leadId,
        pageSize: 20
      }
    });
    setEmailLogs(data.logs);
  }, [leadId]);

  const loadNotes = useCallback(async () => {
    if (!leadId) return;
    const client = await authApi();
    const { data } = await client.get("/api/notes", {
      params: {
        leadId,
        pageSize: 20
      }
    });
    setNotes(data.notes);
  }, [leadId]);

  const loadTasks = useCallback(async () => {
    if (!leadId) return;
    const client = await authApi();
    const { data } = await client.get("/api/tasks", {
      params: {
        leadId,
        pageSize: 20
      }
    });
    setTasks(data.tasks);
  }, [leadId]);

  const loadProfile = useCallback(async () => {
    if (!leadId) return;
    setBusy(true);
    setError("");

    try {
      const client = await authApi();
      const [leadResult, activityResult, assigneeResult, callsResult, smsResult, emailResult, notesResult, tasksResult] = await Promise.all([
        client.get(`/api/leads/${leadId}`),
        client.get(`/api/leads/${leadId}/activities`),
        client.get("/api/leads/assignees"),
        client.get("/api/calls", { params: { leadId, pageSize: 20 } }),
        client.get("/api/sms/logs", { params: { leadId, pageSize: 20 } }),
        client.get("/api/email/logs", { params: { leadId, pageSize: 20 } }),
        client.get("/api/notes", { params: { leadId, pageSize: 20 } }),
        client.get("/api/tasks", { params: { leadId, pageSize: 20 } })
      ]);
      setLead(leadResult.data.lead);
      setActivities(activityResult.data.activities);
      setAssignees(assigneeResult.data);
      setCalls(callsResult.data.calls);
      setSmsLogs(smsResult.data.logs);
      setEmailLogs(emailResult.data.logs);
      setNotes(notesResult.data.notes);
      setTasks(tasksResult.data.tasks);
      setTaskForm((current) => ({ ...current, assignedTo: leadResult.data.lead.owner_id || "" }));
      setCallNotes(Object.fromEntries(callsResult.data.calls.map((call) => [call.id, call.notes || ""])));
    } catch (loadError) {
      setError(loadError.response?.data?.error || "Unable to load lead profile.");
    } finally {
      setBusy(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!configured || loading || !leadId) return;
    loadProfile();
  }, [configured, leadId, loading, loadProfile]);

  if (!configured) return <SupabaseSetupNotice />;

  if (loading || !lead) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cloud text-sm text-slate-600">
        Loading lead profile...
      </main>
    );
  }

  async function updateLead(patch) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      const { data } = await client.patch(`/api/leads/${lead.id}`, patch);
      setLead((current) => ({ ...current, ...data.lead }));
      await loadActivities();
      setNotice("Lead updated.");
    } catch (updateError) {
      setError(updateError.response?.data?.error || "Unable to update lead.");
    } finally {
      setBusy(false);
    }
  }

  async function startCall() {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      await client.post("/api/calls/start", { leadId: lead.id });
      await Promise.all([loadCalls(), loadActivities()]);
      setNotice("Call initiated.");
    } catch (callError) {
      setError(callError.response?.data?.error || "Unable to start call.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCallNote(callId) {
    const notes = callNotes[callId]?.trim();
    if (!notes) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      await client.patch(`/api/calls/${callId}/notes`, { notes });
      await Promise.all([loadCalls(), loadActivities()]);
      setNotice("Call note saved.");
    } catch (callError) {
      setError(callError.response?.data?.error || "Unable to save call note.");
    } finally {
      setBusy(false);
    }
  }

  async function sendSms(event) {
    event.preventDefault();
    if (!smsMessage.trim()) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      await client.post("/api/sms/send", {
        leadId: lead.id,
        message: smsMessage
      });
      setSmsMessage("");
      await Promise.all([loadSmsLogs(), loadActivities()]);
      setNotice("SMS sent.");
    } catch (smsError) {
      setError(smsError.response?.data?.error || "Unable to send SMS.");
    } finally {
      setBusy(false);
    }
  }

  async function sendLeadEmail(event) {
    event.preventDefault();
    if (!emailForm.subject.trim() || !emailForm.body.trim()) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      await client.post("/api/email/send", {
        leadId: lead.id,
        subject: emailForm.subject,
        body: emailForm.body
      });
      setEmailForm({ subject: "", body: "" });
      await Promise.all([loadEmailLogs(), loadActivities()]);
      setNotice("Email sent.");
    } catch (emailError) {
      setError(emailError.response?.data?.error || "Unable to send email.");
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!note.trim()) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      await client.post("/api/notes", {
        leadId: lead.id,
        body: note
      });
      setNote("");
      await Promise.all([loadNotes(), loadActivities()]);
      setNotice("Note added.");
    } catch (noteError) {
      setError(noteError.response?.data?.error || "Unable to add note.");
    } finally {
      setBusy(false);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    if (!taskForm.title.trim()) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      await client.post("/api/tasks", {
        leadId: lead.id,
        title: taskForm.title,
        taskType: taskForm.taskType,
        dueAt: toIsoOrNull(taskForm.dueAt),
        reminderAt: toIsoOrNull(taskForm.reminderAt),
        assignedTo: taskForm.assignedTo || null
      });
      setTaskForm({ title: "", taskType: "follow_up", dueAt: "", reminderAt: "", assignedTo: lead.owner_id || "" });
      await Promise.all([loadTasks(), loadActivities()]);
      setNotice("Task created.");
    } catch (taskError) {
      setError(taskError.response?.data?.error || "Unable to create task.");
    } finally {
      setBusy(false);
    }
  }

  async function updateTask(taskId, patch) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      await client.patch(`/api/tasks/${taskId}`, patch);
      await Promise.all([loadTasks(), loadActivities()]);
      setNotice("Task updated.");
    } catch (taskError) {
      setError(taskError.response?.data?.error || "Unable to update task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-4">
        <Link href="/leads" className="text-sm font-medium text-brand hover:underline">
          Back to leads
        </Link>
      </div>

      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-coral">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">Lead profile</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">{lead.name}</h1>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Info label="Name" value={lead.name} />
            <Info label="Phone" value={lead.phone} />
            <Info label="Email" value={lead.email} />
            <Info label="Source" value={lead.source} />
            <Info label="Owner" value={lead.owner?.name || "Unassigned"} />
            <Info label="Team" value={lead.team?.name || "No team"} />
          </div>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={startCall}
              disabled={busy}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Call {lead.phone}
            </button>
          </div>

          <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Lead Status</span>
              <select
                value={lead.status}
                onChange={(event) => updateLead({ status: event.target.value })}
                disabled={busy}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {LEAD_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Assign User</span>
              <select
                value={lead.owner_id || ""}
                onChange={(event) => updateLead({ owner_id: event.target.value || null })}
                disabled={busy}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {assignees.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.role}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Assign Team</span>
              <select
                value={lead.team_id || ""}
                onChange={(event) => updateLead({ team_id: event.target.value || null })}
                disabled={busy}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">No team</option>
                {assignees.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">Add note</p>
          <form className="mt-3 space-y-3" onSubmit={addNote}>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows="5"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="Write a lead note"
            />
            <button
              type="submit"
              disabled={busy || !note.trim()}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Save note
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">Create task</p>
            <form className="mt-3 space-y-3" onSubmit={createTask}>
              <input
                value={taskForm.title}
                onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="Follow up with lead"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={taskForm.taskType}
                  onChange={(event) => setTaskForm((current) => ({ ...current, taskType: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  {TASK_TYPE_OPTIONS.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <select
                  value={taskForm.assignedTo}
                  onChange={(event) => setTaskForm((current) => ({ ...current, assignedTo: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Assign to me</option>
                  {assignees.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Due</span>
                  <input
                    type="datetime-local"
                    value={taskForm.dueAt}
                    onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Reminder</span>
                  <input
                    type="datetime-local"
                    value={taskForm.reminderAt}
                    onChange={(event) => setTaskForm((current) => ({ ...current, reminderAt: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={busy || !taskForm.title.trim()}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Create Task
              </button>
            </form>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">Single SMS</p>
            <form className="mt-3 space-y-3" onSubmit={sendSms}>
              <textarea
                value={smsMessage}
                onChange={(event) => setSmsMessage(event.target.value)}
                rows="5"
                maxLength="1600"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder={`Message ${lead.name}`}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">{smsMessage.length}/1600</p>
                <button
                  type="submit"
                  disabled={busy || !smsMessage.trim()}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Send SMS
                </button>
              </div>
            </form>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-moss">Single Email</p>
            <form className="mt-3 space-y-3" onSubmit={sendLeadEmail}>
              <input
                value={emailForm.subject}
                onChange={(event) => setEmailForm((current) => ({ ...current, subject: event.target.value }))}
                maxLength="200"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder={`Subject for ${lead.name}`}
              />
              <textarea
                value={emailForm.body}
                onChange={(event) => setEmailForm((current) => ({ ...current, body: event.target.value }))}
                rows="6"
                maxLength="10000"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder={`Email ${lead.name}`}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">{emailForm.body.length}/10000</p>
                <button
                  type="submit"
                  disabled={busy || !emailForm.subject.trim() || !emailForm.body.trim()}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Send Email
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">Notes</p>
          <div className="mt-4 space-y-3">
            {notes.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                <p className="whitespace-pre-wrap text-sm text-slate-700">{item.body}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {item.creator?.name || "CRM user"} - {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))}
            {notes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No notes yet.
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">Tasks</p>
          <div className="mt-4 space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{task.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatTaskType(task.task_type)} - {task.assignee?.name || "Unassigned"}
                    </p>
                    <p className={`mt-1 text-xs ${isOverdue(task) ? "text-coral" : "text-slate-500"}`}>
                      Due {task.due_at ? new Date(task.due_at).toLocaleString() : "not set"}
                    </p>
                    {task.reminder_at ? (
                      <p className="mt-1 text-xs text-slate-500">Reminder {new Date(task.reminder_at).toLocaleString()}</p>
                    ) : null}
                  </div>
                  <select
                    value={task.status}
                    onChange={(event) => updateTask(task.id, { status: event.target.value })}
                    disabled={busy}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-40"
                  >
                    {TASK_STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {tasks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No tasks yet.
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Call history</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Recording</th>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Call Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calls.map((call) => (
                <tr key={call.id}>
                  <td className="px-3 py-3 text-slate-700">{new Date(call.created_at).toLocaleString()}</td>
                  <td className="px-3 py-3 text-slate-700">{call.duration || 0}s</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-medium text-brand">
                      {formatStatus(call.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {call.recording_url ? (
                      <a
                        href={call.recording_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand hover:underline"
                      >
                        Recording
                      </a>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{call.agent?.name || "CRM user"}</td>
                  <td className="min-w-64 px-3 py-3">
                    <div className="flex gap-2">
                      <input
                        value={callNotes[call.id] || ""}
                        onChange={(event) =>
                          setCallNotes((current) => ({
                            ...current,
                            [call.id]: event.target.value
                          }))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                        placeholder="Add call note"
                      />
                      <button
                        type="button"
                        onClick={() => saveCallNote(call.id)}
                        disabled={busy || !callNotes[call.id]?.trim()}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {calls.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-3 py-10 text-center text-slate-500">
                    No call history yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">SMS history</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sender</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {smsLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-3 py-3 text-slate-700">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="max-w-xl px-3 py-3 text-slate-700">{log.message}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-medium text-brand">
                      {formatStatus(log.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{log.creator?.name || "CRM user"}</td>
                </tr>
              ))}
              {smsLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-3 py-10 text-center text-slate-500">
                    No SMS history yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Email history</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Opens</th>
                <th className="px-3 py-2">Clicks</th>
                <th className="px-3 py-2">Sender</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {emailLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-3 py-3 text-slate-700">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="max-w-xl px-3 py-3 text-slate-700">{log.subject}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-medium text-brand">
                      {formatStatus(log.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{log.open_count || 0}</td>
                  <td className="px-3 py-3 text-slate-700">{log.click_count || 0}</td>
                  <td className="px-3 py-3 text-slate-700">{log.creator?.name || "CRM user"}</td>
                </tr>
              ))}
              {emailLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-3 py-10 text-center text-slate-500">
                    No email history yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Activity timeline</p>
        <div className="mt-4 space-y-3">
          {activities.map((activity) => (
            <article key={activity.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold capitalize text-ink">{activity.activity_type}</h3>
                <p className="text-xs text-slate-500">{new Date(activity.created_at).toLocaleString()}</p>
              </div>
              <p className="mt-2 text-sm text-slate-700">{activityText(activity)}</p>
              <p className="mt-2 text-xs text-slate-500">By {activity.creator?.name || "CRM user"}</p>
            </article>
          ))}
          {activities.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No calls, SMS, emails, notes, or tasks yet.
            </p>
          ) : null}
        </div>
      </section>
    </DashboardLayout>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function activityText(activity) {
  const data = activity.activity_data || {};

  if (activity.activity_type === "note") return data.body || "Note added.";
  if (activity.activity_type === "status") return `Status changed from ${data.from} to ${data.to}.`;
  if (activity.activity_type === "assignment") return `Assignment changed for ${data.field}.`;
  if (activity.activity_type === "call") {
    if (data.notes) return `Call note: ${data.notes}`;
    if (data.recording_url) return `Recording saved. Duration: ${data.duration || 0}s.`;
    if (data.status) return `Call ${data.direction || ""} status: ${formatStatus(data.status)}.`;
    return "Call activity logged.";
  }
  if (activity.activity_type === "sms") {
    if (data.message && data.status) return `SMS ${formatStatus(data.status)}: ${data.message}`;
    return "SMS activity logged.";
  }
  if (activity.activity_type === "email") {
    if (data.subject && data.status) return `Email ${formatStatus(data.status)}: ${data.subject}`;
    return "Email activity logged.";
  }
  if (activity.activity_type === "task") {
    if (data.title && data.status) return `Task ${formatStatus(data.status)}: ${data.title}`;
    return "Task activity logged.";
  }

  return "Lead activity logged.";
}

function formatStatus(status) {
  return String(status || "queued").replace(/_/g, " ");
}

function formatTaskType(type) {
  return String(type || "follow_up").replace(/_/g, " ");
}

function isOverdue(task) {
  return task.due_at && task.status !== "completed" && new Date(task.due_at).getTime() < Date.now();
}

function toIsoOrNull(value) {
  return value ? new Date(value).toISOString() : null;
}
