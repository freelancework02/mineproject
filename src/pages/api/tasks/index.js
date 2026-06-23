import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { TASK_STATUS_VALUES, TASK_TYPE_VALUES } from "@/lib/taskConstants";

const querySchema = z.object({
  leadId: z.string().uuid().optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  assigned: z.enum(["me"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(20)
});

const taskSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(200),
  taskType: z.enum(TASK_TYPE_VALUES).default("follow_up"),
  status: z.enum(TASK_STATUS_VALUES).default("pending"),
  dueAt: z.string().datetime().nullable().optional(),
  reminderAt: z.string().datetime().nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional()
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 50 })) return;

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid task query.", details: parsed.error.flatten() });
      return;
    }

    const { leadId, status, assigned, page, pageSize } = parsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = auth.supabase
      .from("tasks")
      .select("id,lead_id,title,task_type,status,due_at,reminder_at,assigned_to,created_by,completed_at,created_at,updated_at,assignee:users!tasks_assigned_to_fkey(id,name,email),creator:users!tasks_created_by_fkey(id,name,email),lead:leads(id,name,email,phone,status)", { count: "exact" })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (leadId) query = query.eq("lead_id", leadId);
    if (status) query = query.eq("status", status);
    if (assigned === "me") query = query.eq("assigned_to", auth.user.id);

    const { data, error, count } = await query;
    if (error) {
      res.status(500).json({ error: "Unable to load tasks." });
      return;
    }

    res.status(200).json({
      tasks: data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / pageSize))
      }
    });
    return;
  }

  if (req.method === "POST") {
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid task.", details: parsed.error.flatten() });
      return;
    }

    const payload = {
      lead_id: parsed.data.leadId || null,
      title: parsed.data.title,
      task_type: parsed.data.taskType,
      status: parsed.data.status,
      due_at: parsed.data.dueAt || null,
      reminder_at: parsed.data.reminderAt || null,
      assigned_to: parsed.data.assignedTo || auth.user.id,
      created_by: auth.user.id,
      completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null
    };

    const { data: task, error } = await auth.supabase
      .from("tasks")
      .insert(payload)
      .select("id,lead_id,title,task_type,status,due_at,reminder_at,assigned_to,created_by,completed_at,created_at,updated_at,assignee:users!tasks_assigned_to_fkey(id,name,email),lead:leads(id,name,email,phone,status)")
      .single();

    if (error) {
      res.status(403).json({ error: "Unable to create task." });
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

    res.status(201).json({ task });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed." });
}
