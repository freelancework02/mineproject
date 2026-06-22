import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { getTwilioClient, hasTwilioServerEnv } from "@/lib/twilioServer";

const sendSchema = z.object({
  leadId: z.string().uuid(),
  message: z.string().trim().min(1).max(1600)
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 20 })) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid SMS request.", details: parsed.error.flatten() });
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
    const twilio = getTwilioClient();
    const message = await twilio.messages.create({
      to: lead.phone,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: parsed.data.message,
      statusCallback: process.env.TWILIO_SMS_STATUS_CALLBACK_URL
    });

    const { data: log, error: logError } = await auth.supabase
      .from("sms_logs")
      .insert({
        lead_id: lead.id,
        message: parsed.data.message,
        status: "sent",
        twilio_message_sid: message.sid,
        created_by: auth.user.id
      })
      .select("id,lead_id,message,status,twilio_message_sid,created_at")
      .single();

    if (logError) throw logError;

    await auth.supabase.from("lead_activities").insert({
      lead_id: lead.id,
      activity_type: "sms",
      activity_data: {
        sms_log_id: log.id,
        message: parsed.data.message,
        status: "sent",
        twilio_message_sid: message.sid
      },
      created_by: auth.user.id
    });

    res.status(201).json({ log });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to send SMS." });
  }
}
