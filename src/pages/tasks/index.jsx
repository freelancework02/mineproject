import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SupabaseSetupNotice from "@/components/auth/SupabaseSetupNotice";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { TASK_STATUS_OPTIONS, TASK_TYPE_OPTIONS } from "@/lib/taskConstants";
import { authApi } from "@/utils/api";

export default function TasksPage() {
  const { configured, loading, user } = useProtectedRoute();
  const [tasks, setTasks] = useState([]);
  const [assignees, setAssignees] = useState({ users: [] });
  const [filters, setFilters] = useState({ status: "", assigned: "me" });
  const [form, setForm] = useState({
    title: "",
    taskType: "follow_up",
    dueAt: "",
    reminderAt: "",
    assignedTo: ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reminderTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status !== "completed" &&
          task.reminder_at &&
          new Date(task.reminder_at).getTime() <= Date.now()
      ),
    [tasks]
  );

  const loadTasks = useCallback(async () => {
    try {
      const client = await authApi();
      const { data } = await client.get("/api/tasks", {
        params: {
          status: filters.status || undefined,
          assigned: filters.assigned || undefined,
          pageSize: 50
        }
      });
      setTasks(data.tasks);
    } catch (loadError) {
      setError(loadError.response?.data?.error || "Unable to load tasks.");
    }
  }, [filters.assigned, filters.status]);

  const loadAssignees = useCallback(async () => {
    try {
      const client = await authApi();
      const { data } = await client.get("/api/leads/assignees");
      setAssignees(data);
      setForm((current) => ({ ...current, assignedTo: current.assignedTo || user?.id || "" }));
    } catch {
      setAssignees({ users: [] });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!configured || loading) return;
    loadTasks();
    loadAssignees();
  }, [configured, loading, loadAssignees, loadTasks]);

  if (!configured) return <SupabaseSetupNotice />;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cloud text-sm text-slate-600">
        Loading secure workspace...
      </main>
    );
  }

  async function createTask(event) {
    event.preventDefault();
    if (!form.title.trim()) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const client = await authApi();
      await client.post("/api/tasks", {
        title: form.title,
        taskType: form.taskType,
        dueAt: toIsoOrNull(form.dueAt),
        reminderAt: toIsoOrNull(form.reminderAt),
        assignedTo: form.assignedTo || null
      });
      setForm({ title: "", taskType: "follow_up", dueAt: "", reminderAt: "", assignedTo: user?.id || "" });
      await loadTasks();
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
      await loadTasks();
      setNotice("Task updated.");
    } catch (taskError) {
      setError(taskError.response?.data?.error || "Unable to update task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardLayout>
      {error ? <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-coral">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-moss">Tasks</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Reminders and follow-ups</h1>
      </div>

      {reminderTasks.length > 0 ? (
        <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Due reminders</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {reminderTasks.map((task) => (
              <article key={task.id} className="rounded-lg border border-amber-200 bg-white p-3">
                <p className="text-sm font-semibold text-ink">{task.title}</p>
                <p className="mt-1 text-xs text-amber-800">Reminder {new Date(task.reminder_at).toLocaleString()}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-ink">Task list</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={filters.assigned}
                onChange={(event) => setFilters((current) => ({ ...current, assigned: event.target.value }))}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="me">Assigned to me</option>
                <option value="">All visible</option>
              </select>
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Any status</option>
                {TASK_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {tasks.map((task) => (
              <article key={task.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{task.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatTaskType(task.task_type)} - {task.assignee?.name || "Unassigned"}
                    </p>
                    {task.lead ? (
                      <Link href={`/leads/${task.lead.id}`} className="mt-1 block text-xs font-medium text-brand hover:underline">
                        {task.lead.name}
                      </Link>
                    ) : null}
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
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 md:w-40"
                  >
                    {TASK_STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </article>
            ))}
            {tasks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No tasks match these filters.
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">New Task</p>
          <form className="mt-4 space-y-3" onSubmit={createTask}>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="Call customer"
            />
            <select
              value={form.taskType}
              onChange={(event) => setForm((current) => ({ ...current, taskType: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              {TASK_TYPE_OPTIONS.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <select
              value={form.assignedTo}
              onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">Assign to me</option>
              {assignees.users.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))}
            </select>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Due</span>
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Reminder</span>
              <input
                type="datetime-local"
                value={form.reminderAt}
                onChange={(event) => setForm((current) => ({ ...current, reminderAt: event.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !form.title.trim()}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Create Task
            </button>
          </form>
        </section>
      </div>
    </DashboardLayout>
  );
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
