import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { TASK_STATUS_VALUES, TASK_TYPE_VALUES } from "@/lib/taskConstants";

const idSchema = z.string().uuid();
const updateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  taskType: z.enum(TASK_TYPE_VALUES).optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  reminderAt: z.string().datetime().nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional()
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 50 })) return;

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsedId = idSchema.safeParse(req.query.id);
  if (!parsedId.success) {
    res.status(422).json({ error: "Invalid task id." });
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid task update.", details: parsed.error.flatten() });
    return;
  }

  const patch = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.taskType !== undefined) patch.task_type = parsed.data.taskType;
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
    patch.completed_at = parsed.data.status === "completed" ? new Date().toISOString() : null;
  }
  if (parsed.data.dueAt !== undefined) patch.due_at = parsed.data.dueAt;
  if (parsed.data.reminderAt !== undefined) patch.reminder_at = parsed.data.reminderAt;
  if (parsed.data.assignedTo !== undefined) patch.assigned_to = parsed.data.assignedTo;

  const { data: task, error } = await auth.supabase
    .from("tasks")
    .update(patch)
    .eq("id", parsedId.data)
    .select("id,lead_id,title,task_type,status,due_at,reminder_at,assigned_to,created_by,completed_at,created_at,updated_at,assignee:users!tasks_assigned_to_fkey(id,name,email),lead:leads(id,name,email,phone,status)")
    .single();

  if (error) {
    res.status(403).json({ error: "Unable to update task." });
    return;
  }

  if (task.lead_id) {
    await auth.supabase.from("lead_activities").insert({
      lead_id: task.lead_id,
      activity_type: "task",
      activity_data: {
        task_id: task.id,
        title: task.title,
        task_type: task.task_type,
        status: task.status,
        due_at: task.due_at
      },
      created_by: auth.user.id
    });
  }

  res.status(200).json({ task });
}
