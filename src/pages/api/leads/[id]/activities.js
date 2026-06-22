import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";

const idSchema = z.string().uuid();
const activitySchema = z.object({
  activity_type: z.enum(["note"]),
  body: z.string().trim().min(1).max(2000)
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 40 })) return;

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsedId = idSchema.safeParse(req.query.id);
  if (!parsedId.success) {
    res.status(422).json({ error: "Invalid lead id." });
    return;
  }

  if (req.method === "GET") {
    const { data, error } = await auth.supabase
      .from("lead_activities")
      .select("id,lead_id,activity_type,activity_data,created_by,created_at,creator:users!lead_activities_created_by_fkey(id,name,email)")
      .eq("lead_id", parsedId.data)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      res.status(500).json({ error: "Unable to load lead activity." });
      return;
    }

    res.status(200).json({ activities: data });
    return;
  }

  if (req.method === "POST") {
    const parsed = activitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid activity.", details: parsed.error.flatten() });
      return;
    }

    const { data, error } = await auth.supabase
      .from("lead_activities")
      .insert({
        lead_id: parsedId.data,
        activity_type: parsed.data.activity_type,
        activity_data: { body: parsed.data.body },
        created_by: auth.user.id
      })
      .select("id,lead_id,activity_type,activity_data,created_by,created_at,creator:users!lead_activities_created_by_fkey(id,name,email)")
      .single();

    if (error) {
      res.status(403).json({ error: "Unable to add activity for this lead." });
      return;
    }

    res.status(201).json({ activity: data });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed." });
}
