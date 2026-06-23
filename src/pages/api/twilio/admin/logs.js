import { z } from "zod";
import { requireApiProfile } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";

const ALLOWED_ROLES = ["super_admin", "admin", "manager"];

const querySchema = z.object({
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 40 })) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiProfile(req, res, ALLOWED_ROLES);
  if (!auth) return;

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid Twilio admin log query.", details: parsed.error.flatten() });
    return;
  }

  const { pageSize } = parsed.data;
  const [callsResult, smsResult, recordingsResult, webhookResult] = await Promise.all([
    auth.supabase
      .from("call_logs")
      .select("id,lead_id,twilio_call_sid,direction,status,duration,from_number,to_number,created_at,agent:users!call_logs_agent_id_fkey(id,name,email)")
      .order("created_at", { ascending: false })
      .limit(pageSize),
    auth.supabase
      .from("sms_logs")
      .select("id,lead_id,message,status,twilio_message_sid,error_message,created_at,creator:users!sms_logs_created_by_fkey(id,name,email)")
      .order("created_at", { ascending: false })
      .limit(pageSize),
    auth.supabase
      .from("call_logs")
      .select("id,lead_id,twilio_call_sid,recording_url,duration,created_at,agent:users!call_logs_agent_id_fkey(id,name,email)")
      .not("recording_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(pageSize),
    auth.supabase
      .from("twilio_webhook_events")
      .select("id,event_type,twilio_sid,processed,error_message,created_at")
      .order("created_at", { ascending: false })
      .limit(pageSize)
  ]);

  const error = callsResult.error || smsResult.error || recordingsResult.error || webhookResult.error;
  if (error) {
    res.status(500).json({ error: "Unable to load Twilio logs." });
    return;
  }

  res.status(200).json({
    calls: callsResult.data || [],
    sms: smsResult.data || [],
    recordings: recordingsResult.data || [],
    webhooks: webhookResult.data || []
  });
}
