import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { verifyTwilioRequest } from "@/lib/twilioServer";
import { normalizePhone } from "@/utils/leadImport";

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

  const publicUrl = process.env.TWILIO_INCOMING_WEBHOOK_URL;
  if (publicUrl && !verifyTwilioRequest(req, publicUrl, req.body)) {
    res.status(403).send("Invalid Twilio signature.");
    return;
  }

  const supabase = serviceClient();
  const fromNumber = req.body.From || "";
  const toNumber = req.body.To || "";
  const callSid = req.body.CallSid;
  const normalizedFrom = normalizePhone(fromNumber);

  const { data: lead } = normalizedFrom
    ? await supabase
        .from("leads")
        .select("id,owner_id")
        .eq("phone_normalized", normalizedFrom)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const { data: call } = await supabase
    .from("call_logs")
    .upsert(
      {
        lead_id: lead?.id || null,
        twilio_call_sid: callSid,
        direction: "incoming",
        status: "ringing",
        agent_id: lead?.owner_id || null,
        from_number: fromNumber,
        to_number: toNumber
      },
      { onConflict: "twilio_call_sid" }
    )
    .select("id,lead_id,agent_id")
    .single();

  await supabase.from("twilio_webhook_events").insert({
    event_type: "incoming_call",
    twilio_sid: callSid,
    payload: req.body,
    processed: true
  });

  if (call?.lead_id && call.agent_id) {
    await supabase.from("lead_activities").insert({
      lead_id: call.lead_id,
      activity_type: "call",
      activity_data: {
        call_log_id: call.id,
        direction: "incoming",
        status: "ringing",
        from_number: fromNumber
      },
      created_by: call.agent_id
    });
  }

  res.setHeader("Content-Type", "text/xml");
  res.status(200).send("<Response><Say voice=\"alice\">Thank you for calling. An agent will follow up shortly.</Say></Response>");
}

function serviceClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
}
