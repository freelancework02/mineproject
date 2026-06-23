import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb"
    }
  }
};

const EVENT_STATUS = {
  delivered: "delivered",
  open: "opened",
  click: "clicked",
  bounce: "bounced",
  dropped: "failed",
  deferred: "queued",
  processed: "queued"
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).send("Method not allowed.");
    return;
  }

  const webhookSecret = process.env.SENDGRID_WEBHOOK_SECRET;
  if (webhookSecret && req.headers["x-crm-webhook-secret"] !== webhookSecret) {
    res.status(403).send("Invalid SendGrid webhook secret.");
    return;
  }

  const events = Array.isArray(req.body) ? req.body : [];
  const supabase = serviceClient();

  for (const event of events) {
    const logId = event.email_log_id;
    const status = EVENT_STATUS[event.event];
    if (!logId || !status) continue;

    const patch = { status };
    const eventTime = event.timestamp ? new Date(event.timestamp * 1000).toISOString() : new Date().toISOString();

    if (event.event === "open") {
      patch.opened_at = eventTime;
      patch.open_count = event.sg_event_id ? undefined : undefined;
    }
    if (event.event === "click") patch.clicked_at = eventTime;
    if (event.event === "bounce") {
      patch.bounced_at = eventTime;
      patch.error_message = event.reason || event.response || null;
    }
    if (event.event === "dropped") patch.error_message = event.reason || event.response || null;

    const { data: log } = await supabase
      .from("email_logs")
      .select("id,lead_id,campaign_id,created_by,subject,open_count,click_count")
      .eq("id", logId)
      .single();

    if (!log) continue;

    if (event.event === "open") patch.open_count = (log.open_count || 0) + 1;
    if (event.event === "click") patch.click_count = (log.click_count || 0) + 1;

    await supabase.from("email_logs").update(patch).eq("id", logId);

    if (log.campaign_id && ["open", "click", "bounce"].includes(event.event)) {
      const field = event.event === "open" ? "opened_count" : event.event === "click" ? "clicked_count" : "bounced_count";
      const { data: campaign } = await supabase.from("email_campaigns").select(field).eq("id", log.campaign_id).single();
      if (campaign) {
        await supabase
          .from("email_campaigns")
          .update({ [field]: (campaign[field] || 0) + 1 })
          .eq("id", log.campaign_id);
      }
    }

    if (log.lead_id && log.created_by) {
      await supabase.from("lead_activities").insert({
        lead_id: log.lead_id,
        activity_type: "email",
        activity_data: {
          email_log_id: log.id,
          subject: log.subject,
          status,
          event: event.event
        },
        created_by: log.created_by
      });
    }
  }

  res.status(200).send("ok");
}

function serviceClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
}
