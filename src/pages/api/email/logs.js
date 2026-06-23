import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";

const querySchema = z.object({
  leadId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 50 })) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid email log query.", details: parsed.error.flatten() });
    return;
  }

  const { leadId, page, pageSize } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = auth.supabase
    .from("email_logs")
    .select("id,lead_id,campaign_id,recipient_email,subject,body,status,provider_message_id,error_message,open_count,click_count,opened_at,clicked_at,bounced_at,created_by,created_at,creator:users!email_logs_created_by_fkey(id,name,email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (leadId) query = query.eq("lead_id", leadId);

  const { data, error, count } = await query;
  if (error) {
    res.status(500).json({ error: "Unable to load email logs." });
    return;
  }

  res.status(200).json({
    logs: data,
    pagination: {
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize))
    }
  });
}
