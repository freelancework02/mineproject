import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { LEAD_STATUS_VALUES } from "@/lib/leadConstants";
import { rateLimit } from "@/lib/rateLimit";

const idSchema = z.string().uuid();

const updateSchema = z.object({
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  owner_id: z.string().uuid().nullable().optional(),
  team_id: z.string().uuid().nullable().optional()
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
    await getLead(auth.supabase, parsedId.data, res);
    return;
  }

  if (req.method === "PATCH") {
    await updateLead(auth.supabase, auth.user.id, parsedId.data, req.body, res);
    return;
  }

  res.setHeader("Allow", "GET, PATCH");
  res.status(405).json({ error: "Method not allowed." });
}

async function getLead(supabase, leadId, res) {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id,name,email,phone,source,status,owner_id,team_id,created_at,updated_at,owner:users!leads_owner_id_fkey(id,name,email,role),team:teams(id,name)"
    )
    .eq("id", leadId)
    .single();

  if (error) {
    res.status(error.code === "PGRST116" ? 404 : 500).json({ error: "Lead not found." });
    return;
  }

  res.status(200).json({ lead: data });
}

async function updateLead(supabase, userId, leadId, body, res) {
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid lead update.", details: parsed.error.flatten() });
    return;
  }

  const { data: before, error: beforeError } = await supabase
    .from("leads")
    .select("id,status,owner_id,team_id")
    .eq("id", leadId)
    .single();

  if (beforeError) {
    res.status(beforeError.code === "PGRST116" ? 404 : 500).json({ error: "Lead not found." });
    return;
  }

  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(patch).length === 0) {
    res.status(422).json({ error: "No supported lead fields were provided." });
    return;
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", leadId)
    .select("id,name,email,phone,source,status,owner_id,team_id,created_at,updated_at")
    .single();

  if (error) {
    res.status(403).json({ error: "Unable to update this lead." });
    return;
  }

  const activities = [];
  if (patch.status && patch.status !== before.status) {
    activities.push({
      lead_id: leadId,
      activity_type: "status",
      activity_data: { from: before.status, to: patch.status },
      created_by: userId
    });
  }
  if ("owner_id" in patch && patch.owner_id !== before.owner_id) {
    activities.push({
      lead_id: leadId,
      activity_type: "assignment",
      activity_data: { field: "owner_id", from: before.owner_id, to: patch.owner_id },
      created_by: userId
    });
  }
  if ("team_id" in patch && patch.team_id !== before.team_id) {
    activities.push({
      lead_id: leadId,
      activity_type: "assignment",
      activity_data: { field: "team_id", from: before.team_id, to: patch.team_id },
      created_by: userId
    });
  }

  if (activities.length > 0) {
    await supabase.from("lead_activities").insert(activities);
  }

  res.status(200).json({ lead });
}
