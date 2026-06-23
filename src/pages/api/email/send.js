import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { hasSendGridServerEnv, sendEmail } from "@/lib/sendgridServer";

const sendSchema = z.object({
  leadId: z.string().uuid(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000)
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
    res.status(422).json({ error: "Invalid email request.", details: parsed.error.flatten() });
    return;
  }

  if (!hasSendGridServerEnv()) {
    res.status(503).json({ error: "SendGrid server environment variables are not configured." });
    return;
  }

  const { data: lead, error: leadError } = await auth.supabase
    .from("leads")
    .select("id,name,email")
    .eq("id", parsed.data.leadId)
    .single();

  if (leadError || !lead?.email) {
    res.status(404).json({ error: "Lead not found, not visible, or missing email." });
    return;
  }

  const { data: log, error: logError } = await auth.supabase
    .from("email_logs")
    .insert({
      lead_id: lead.id,
      recipient_email: lead.email,
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: "queued",
      created_by: auth.user.id
    })
    .select("id,lead_id,recipient_email,subject,body,status,provider_message_id,created_at")
    .single();

  if (logError) {
    res.status(500).json({ error: "Unable to create email log." });
    return;
  }

  try {
    const result = await sendEmail({
      to: lead.email,
      subject: parsed.data.subject,
      body: parsed.data.body,
      customArgs: {
        email_log_id: log.id,
        lead_id: lead.id
      }
    });

    const { data: sentLog, error: updateError } = await auth.supabase
      .from("email_logs")
      .update({
        status: "sent",
        provider_message_id: result.messageId
      })
      .eq("id", log.id)
      .select("id,lead_id,recipient_email,subject,body,status,provider_message_id,created_at")
      .single();

    if (updateError) throw updateError;

    await auth.supabase.from("lead_activities").insert({
      lead_id: lead.id,
      activity_type: "email",
      activity_data: {
        email_log_id: log.id,
        subject: parsed.data.subject,
        status: "sent",
        provider_message_id: result.messageId
      },
      created_by: auth.user.id
    });

    res.status(201).json({ log: sentLog });
  } catch (error) {
    await auth.supabase
      .from("email_logs")
      .update({ status: "failed", error_message: error.message })
      .eq("id", log.id);
    res.status(500).json({ error: error.message || "Unable to send email." });
  }
}
