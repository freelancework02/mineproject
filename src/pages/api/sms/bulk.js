import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { getTwilioClient, hasTwilioServerEnv } from "@/lib/twilioServer";
import { normalizePhone } from "@/utils/leadImport";

const bulkSchema = z.object({
  name: z.string().trim().min(2).max(160).default("Bulk SMS Campaign"),
  message: z.string().trim().min(1).max(1600),
  leadIds: z.array(z.string().uuid()).max(250).optional(),
  filters: z
    .object({
      status: z.string().trim().optional(),
      source: z.string().trim().optional()
    })
    .optional(),
  uploadedRecipients: z
    .array(
      z.object({
        name: z.string().optional(),
        phone: z.string().min(7)
      })
    )
    .max(250)
    .optional()
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 8 })) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid bulk SMS request.", details: parsed.error.flatten() });
    return;
  }

  if (!hasTwilioServerEnv()) {
    res.status(503).json({ error: "Twilio server environment variables are not configured." });
    return;
  }

  try {
    const recipients = await resolveRecipients(auth.supabase, parsed.data);

    if (recipients.length === 0) {
      res.status(422).json({ error: "No recipients matched this campaign." });
      return;
    }

    const { data: campaign, error: campaignError } = await auth.supabase
      .from("sms_campaigns")
      .insert({
        name: parsed.data.name,
        message: parsed.data.message,
        total_recipients: recipients.length,
        created_by: auth.user.id
      })
      .select("id,name,message,total_recipients,sent_count,failed_count,created_at")
      .single();

    if (campaignError) throw campaignError;

    const twilio = getTwilioClient();
    let sent = 0;
    let failed = 0;
    const logs = [];

    for (const recipient of recipients) {
      try {
        const message = await twilio.messages.create({
          to: recipient.phone,
          from: process.env.TWILIO_PHONE_NUMBER,
          body: parsed.data.message,
          statusCallback: process.env.TWILIO_SMS_STATUS_CALLBACK_URL
        });
        sent += 1;
        logs.push({
          lead_id: recipient.lead_id || null,
          campaign_id: campaign.id,
          message: parsed.data.message,
          status: "sent",
          twilio_message_sid: message.sid,
          created_by: auth.user.id
        });
      } catch (error) {
        failed += 1;
        logs.push({
          lead_id: recipient.lead_id || null,
          campaign_id: campaign.id,
          message: parsed.data.message,
          status: "failed",
          error_message: error.message,
          created_by: auth.user.id
        });
      }
    }

    if (logs.length) {
      await auth.supabase.from("sms_logs").insert(logs);
    }

    await auth.supabase
      .from("sms_campaigns")
      .update({ sent_count: sent, failed_count: failed })
      .eq("id", campaign.id);

    const activityRows = logs
      .filter((log) => log.lead_id)
      .map((log) => ({
        lead_id: log.lead_id,
        activity_type: "sms",
        activity_data: {
          campaign_id: campaign.id,
          message: log.message,
          status: log.status,
          twilio_message_sid: log.twilio_message_sid
        },
        created_by: auth.user.id
      }));

    if (activityRows.length) {
      await auth.supabase.from("lead_activities").insert(activityRows);
    }

    res.status(201).json({
      campaign: {
        ...campaign,
        sent_count: sent,
        failed_count: failed
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to send bulk SMS." });
  }
}

async function resolveRecipients(supabase, payload) {
  const uploaded = (payload.uploadedRecipients || []).map((recipient) => ({
    lead_id: null,
    phone: normalizePhone(recipient.phone)
  }));

  let leadQuery = supabase.from("leads").select("id,phone");

  if (payload.leadIds?.length) leadQuery = leadQuery.in("id", payload.leadIds);
  if (payload.filters?.status) leadQuery = leadQuery.eq("status", payload.filters.status);
  if (payload.filters?.source) leadQuery = leadQuery.ilike("source", `%${payload.filters.source.replace(/[%]/g, "")}%`);

  const shouldLoadLeads = payload.leadIds?.length || payload.filters?.status || payload.filters?.source;
  const leadRecipients = shouldLoadLeads
    ? await leadQuery.limit(250)
    : { data: [], error: null };

  if (leadRecipients.error) throw leadRecipients.error;

  const combined = [
    ...(leadRecipients.data || []).map((lead) => ({ lead_id: lead.id, phone: lead.phone })),
    ...uploaded
  ].filter((recipient) => recipient.phone);

  const seen = new Set();
  return combined.filter((recipient) => {
    const normalized = normalizePhone(recipient.phone);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
