import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { toTwilioStatus, verifyTwilioRequest } from "@/lib/twilioServer";

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

  const publicUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
  if (publicUrl && !verifyTwilioRequest(req, publicUrl, req.body)) {
    res.status(403).send("Invalid Twilio signature.");
    return;
  }

  const supabase = serviceClient();
  const callSid = req.body.CallSid;
  const status = toTwilioStatus(req.body.CallStatus);
  const duration = Number(req.body.CallDuration || 0);

  await supabase.from("twilio_webhook_events").insert({
    event_type: "call_status",
    twilio_sid: callSid,
    payload: req.body,
    processed: true
  });

  if (callSid) {
    const { data: call } = await supabase
      .from("call_logs")
      .update({ status, duration })
      .eq("twilio_call_sid", callSid)
      .select("id,lead_id,agent_id,direction,status,duration")
      .single();

    if (call?.lead_id && call.agent_id) {
      await supabase.from("lead_activities").insert({
        lead_id: call.lead_id,
        activity_type: "call",
        activity_data: {
          call_log_id: call.id,
          direction: call.direction,
          status: call.status,
          duration: call.duration
        },
        created_by: call.agent_id
      });
    }
  }

  res.status(200).send("ok");
}

function serviceClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
}
