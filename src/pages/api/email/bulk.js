import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { LEAD_STATUS_VALUES } from "@/lib/leadConstants";
import { rateLimit } from "@/lib/rateLimit";
import { hasSendGridServerEnv, sendEmail } from "@/lib/sendgridServer";

const uploadedRecipientSchema = z.object({
  name: z.string().optional(),
  email: z.string().email()
});

const bulkSchema = z.object({
  name: z.string().trim().min(2).max(160).default("Bulk Email Campaign"),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  leadIds: z.array(z.string().uuid()).max(250).optional(),
  filters: z
    .object({
      status: z.enum(LEAD_STATUS_VALUES).optional(),
      source: z.string().trim().optional()
    })
    .optional(),
  uploadedRecipients: z.array(uploadedRecipientSchema).max(250).optional()
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
    res.status(422).json({ error: "Invalid bulk email request.", details: parsed.error.flatten() });
    return;
  }

  if (!hasSendGridServerEnv()) {
    res.status(503).json({ error: "SendGrid server environment variables are not configured." });
    return;
  }

  try {
    const recipients = await resolveRecipients(auth.supabase, parsed.data);

    if (recipients.length === 0) {
      res.status(422).json({ error: "No recipients matched this campaign." });
      return;
    }

    const { data: campaign, error: campaignError } = await auth.supabase
      .from("email_campaigns")
      .insert({
        name: parsed.data.name,
        subject: parsed.data.subject,
        body: parsed.data.body,
        total_recipients: recipients.length,
        created_by: auth.user.id
      })
      .select("id,name,subject,body,total_recipients,sent_count,failed_count,opened_count,clicked_count,bounced_count,created_at")
      .single();

    if (campaignError) throw campaignError;

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const { data: log, error: logError } = await auth.supabase
        .from("email_logs")
        .insert({
          lead_id: recipient.lead_id || null,
          campaign_id: campaign.id,
          recipient_email: recipient.email,
          subject: parsed.data.subject,
          body: parsed.data.body,
          status: "queued",
          created_by: auth.user.id
        })
        .select("id")
        .single();

      if (logError) throw logError;

      try {
        const result = await sendEmail({
          to: recipient.email,
          subject: parsed.data.subject,
          body: parsed.data.body,
          customArgs: {
            email_log_id: log.id,
            campaign_id: campaign.id,
            lead_id: recipient.lead_id || ""
          }
        });
        sent += 1;
        await auth.supabase
          .from("email_logs")
          .update({ status: "sent", provider_message_id: result.messageId })
          .eq("id", log.id);

        if (recipient.lead_id) {
          await auth.supabase.from("lead_activities").insert({
            lead_id: recipient.lead_id,
            activity_type: "email",
            activity_data: {
              email_log_id: log.id,
              campaign_id: campaign.id,
              subject: parsed.data.subject,
              status: "sent",
              provider_message_id: result.messageId
            },
            created_by: auth.user.id
          });
        }
      } catch (error) {
        failed += 1;
        await auth.supabase
          .from("email_logs")
          .update({ status: "failed", error_message: error.message })
          .eq("id", log.id);
      }
    }

    await auth.supabase
      .from("email_campaigns")
      .update({ sent_count: sent, failed_count: failed })
      .eq("id", campaign.id);

    res.status(201).json({
      campaign: {
        ...campaign,
        sent_count: sent,
        failed_count: failed
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to send bulk email." });
  }
}

async function resolveRecipients(supabase, payload) {
  const uploaded = (payload.uploadedRecipients || []).map((recipient) => ({
    lead_id: null,
    email: recipient.email.toLowerCase()
  }));

  let leadQuery = supabase.from("leads").select("id,email").not("email", "is", null);

  if (payload.leadIds?.length) leadQuery = leadQuery.in("id", payload.leadIds);
  if (payload.filters?.status) leadQuery = leadQuery.eq("status", payload.filters.status);
  if (payload.filters?.source) leadQuery = leadQuery.ilike("source", `%${payload.filters.source.replace(/[%]/g, "")}%`);

  const shouldLoadLeads = payload.leadIds?.length || payload.filters?.status || payload.filters?.source;
  const leadRecipients = shouldLoadLeads ? await leadQuery.limit(250) : { data: [], error: null };

  if (leadRecipients.error) throw leadRecipients.error;

  const combined = [
    ...(leadRecipients.data || []).map((lead) => ({ lead_id: lead.id, email: lead.email?.toLowerCase() })),
    ...uploaded
  ].filter((recipient) => recipient.email);

  const seen = new Set();
  return combined.filter((recipient) => {
    if (seen.has(recipient.email)) return false;
    seen.add(recipient.email);
    return true;
  });
}
