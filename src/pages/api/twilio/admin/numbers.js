import { z } from "zod";
import { requireApiProfile } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { getTwilioClient } from "@/lib/twilioServer";

const READ_ROLES = ["super_admin", "admin", "manager"];
const WRITE_ROLES = ["super_admin", "admin"];

const assignmentSchema = z.object({
  phoneNumber: z.string().trim().min(6).max(32),
  assignedUserId: z.string().uuid().nullable().optional(),
  assignedTeamId: z.string().uuid().nullable().optional(),
  friendlyName: z.string().trim().max(120).nullable().optional()
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 40 })) return;

  if (req.method === "GET") {
    const auth = await requireApiProfile(req, res, READ_ROLES);
    if (!auth) return;
    await handleGet(auth, res);
    return;
  }

  if (req.method === "POST") {
    const auth = await requireApiProfile(req, res, WRITE_ROLES);
    if (!auth) return;
    await handlePost(auth, req, res);
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed." });
}

async function handleGet(auth, res) {
  const [assignmentsResult, usersResult, teamsResult] = await Promise.all([
    auth.supabase
      .from("twilio_number_assignments")
      .select("id,phone_number,assigned_user_id,assigned_team_id,friendly_name,created_at,updated_at,user:users!twilio_number_assignments_assigned_user_id_fkey(id,name,email),team:teams!twilio_number_assignments_assigned_team_id_fkey(id,name)")
      .order("phone_number"),
    auth.supabase.from("users").select("id,name,email,role").order("name"),
    auth.supabase.from("teams").select("id,name").order("name")
  ]);

  if (assignmentsResult.error) {
    res.status(500).json({ error: "Unable to load number assignments." });
    return;
  }

  let purchasedNumbers = [];
  let configured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

  if (configured) {
    try {
      const client = getTwilioClient();
      const numbers = await client.incomingPhoneNumbers.list({ limit: 100 });
      purchasedNumbers = numbers.map((number) => ({
        sid: number.sid,
        phoneNumber: number.phoneNumber,
        friendlyName: number.friendlyName,
        capabilities: number.capabilities,
        dateCreated: number.dateCreated
      }));
    } catch (error) {
      res.status(502).json({ error: error.message || "Unable to load Twilio phone numbers." });
      return;
    }
  }

  res.status(200).json({
    configured,
    purchasedNumbers,
    assignments: assignmentsResult.data || [],
    users: usersResult.data || [],
    teams: teamsResult.data || []
  });
}

async function handlePost(auth, req, res) {
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid number assignment.", details: parsed.error.flatten() });
    return;
  }

  const payload = {
    phone_number: parsed.data.phoneNumber,
    assigned_user_id: parsed.data.assignedUserId || null,
    assigned_team_id: parsed.data.assignedTeamId || null,
    friendly_name: parsed.data.friendlyName || null,
    created_by: auth.user.id
  };

  const { data, error } = await auth.supabase
    .from("twilio_number_assignments")
    .upsert(payload, { onConflict: "phone_number" })
    .select("id,phone_number,assigned_user_id,assigned_team_id,friendly_name,created_at,updated_at")
    .single();

  if (error) {
    res.status(500).json({ error: "Unable to save number assignment." });
    return;
  }

  res.status(200).json({ assignment: data });
}
