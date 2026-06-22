import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";

const idSchema = z.string().uuid();
const noteSchema = z.object({
  notes: z.string().trim().min(1).max(2000)
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 20 })) return;

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsedId = idSchema.safeParse(req.query.id);
  const parsedBody = noteSchema.safeParse(req.body);

  if (!parsedId.success || !parsedBody.success) {
    res.status(422).json({ error: "Invalid call note request." });
    return;
  }

  const { data: call, error } = await auth.supabase
    .from("call_logs")
    .update({ notes: parsedBody.data.notes })
    .eq("id", parsedId.data)
    .select("id,lead_id,notes")
    .single();

  if (error) {
    res.status(403).json({ error: "Unable to update call notes." });
    return;
  }

  if (call.lead_id) {
    await auth.supabase.from("lead_activities").insert({
      lead_id: call.lead_id,
      activity_type: "call",
      activity_data: {
        call_log_id: call.id,
        notes: call.notes
      },
      created_by: auth.user.id
    });
  }

  res.status(200).json({ call });
}
