import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { getTwilioClient, hasTwilioServerEnv } from "@/lib/twilioServer";

const startSchema = z.object({
  leadId: z.string().uuid()
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 10 })) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid call request.", details: parsed.error.flatten() });
    return;
  }

  const { data: lead, error: leadError } = await auth.supabase
    .from("leads")
    .select("id,name,phone")
    .eq("id", parsed.data.leadId)
    .single();

  if (leadError) {
    res.status(404).json({ error: "Lead not found or not visible." });
    return;
  }

  if (!hasTwilioServerEnv()) {
    res.status(503).json({ error: "Twilio server environment variables are not configured." });
    return;
  }

  try {
    const client = getTwilioClient();
    const call = await client.calls.create({
      to: lead.phone,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: `<Response><Say voice="alice">Connecting you to ${escapeXml(lead.name)} from Marketing CRM.</Say></Response>`,
      record: true,
      statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      recordingStatusCallback: process.env.TWILIO_RECORDING_CALLBACK_URL
    });

    const { data: log, error: logError } = await auth.supabase
      .from("call_logs")
      .insert({
        lead_id: lead.id,
        twilio_call_sid: call.sid,
        direction: "outgoing",
        status: "queued",
        agent_id: auth.user.id,
        from_number: process.env.TWILIO_PHONE_NUMBER,
        to_number: lead.phone
      })
      .select("id,lead_id,twilio_call_sid,direction,status,duration,recording_url,notes,agent_id,from_number,to_number,created_at")
      .single();

    if (logError) throw logError;

    await auth.supabase.from("lead_activities").insert({
      lead_id: lead.id,
      activity_type: "call",
      activity_data: {
        call_log_id: log.id,
        direction: "outgoing",
        status: "queued",
        twilio_call_sid: call.sid
      },
      created_by: auth.user.id
    });

    res.status(201).json({ call: log });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to start call." });
  }
}

function escapeXml(value) {
  return String(value || "lead")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
