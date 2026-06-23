import { requireApiProfile } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { getTwilioClient } from "@/lib/twilioServer";

const ALLOWED_ROLES = ["super_admin", "admin", "manager"];

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 30 })) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiProfile(req, res, ALLOWED_ROLES);
  if (!auth) return;

  const [callResult, smsResult, webhookResult, assignmentResult] = await Promise.all([
    auth.supabase.from("call_logs").select("id,status,direction,duration,recording_url,created_at", { count: "exact" }).limit(1),
    auth.supabase.from("sms_logs").select("id,status,created_at", { count: "exact" }).limit(1),
    auth.supabase.from("twilio_webhook_events").select("id,processed,error_message,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(20),
    auth.supabase.from("twilio_number_assignments").select("id", { count: "exact" }).limit(1)
  ]);

  const localStats = {
    totalCalls: callResult.count || 0,
    totalSms: smsResult.count || 0,
    assignedNumbers: assignmentResult.count || 0,
    recentWebhookFailures: (webhookResult.data || []).filter((event) => !event.processed || event.error_message).length
  };

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    res.status(200).json({
      configured: false,
      balance: null,
      activeNumbers: 0,
      usage: [],
      localStats
    });
    return;
  }

  try {
    const client = getTwilioClient();
    const [balance, numbers, usage] = await Promise.all([
      client.api.v2010.account.balance.fetch(),
      client.incomingPhoneNumbers.list({ limit: 100 }),
      client.usage.records.thisMonth.list({ limit: 20 })
    ]);

    res.status(200).json({
      configured: true,
      balance: {
        amount: balance.balance,
        currency: balance.currency
      },
      activeNumbers: numbers.length,
      usage: usage.map((record) => ({
        category: record.category,
        description: record.description,
        count: record.count,
        countUnit: record.countUnit,
        price: record.price,
        priceUnit: record.priceUnit
      })),
      localStats
    });
  } catch (error) {
    res.status(502).json({ error: error.message || "Unable to load Twilio account overview." });
  }
}
