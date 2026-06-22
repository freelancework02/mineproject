import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { toTwilioSmsStatus, verifyTwilioRequest } from "@/lib/twilioServer";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb"
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).send("Method not allowed.");
    return;
  }

  const publicUrl = process.env.TWILIO_SMS_STATUS_CALLBACK_URL;
  if (publicUrl && !verifyTwilioRequest(req, publicUrl, req.body)) {
    res.status(403).send("Invalid Twilio signature.");
    return;
  }

  const supabase = serviceClient();
  const messageSid = req.body.MessageSid || req.body.SmsSid;
  const status = toTwilioSmsStatus(req.body.MessageStatus || req.body.SmsStatus);
  const errorMessage = req.body.ErrorMessage || req.body.ErrorCode || null;

  await supabase.from("twilio_webhook_events").insert({
    event_type: "sms_status",
    twilio_sid: messageSid,
    payload: req.body,
    processed: true
  });

  if (messageSid) {
    const { data: log } = await supabase
      .from("sms_logs")
      .update({ status, error_message: errorMessage })
      .eq("twilio_message_sid", messageSid)
      .select("id,lead_id,created_by,message,status,twilio_message_sid")
      .single();

    if (log?.lead_id && log.created_by) {
      await supabase.from("lead_activities").insert({
        lead_id: log.lead_id,
        activity_type: "sms",
        activity_data: {
          sms_log_id: log.id,
          message: log.message,
          status: log.status,
          twilio_message_sid: log.twilio_message_sid
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
