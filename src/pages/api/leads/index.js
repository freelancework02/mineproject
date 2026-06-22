import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { LEAD_SORT_FIELDS, LEAD_STATUS_VALUES } from "@/lib/leadConstants";
import { rateLimit } from "@/lib/rateLimit";

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(120).optional(),
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  source: z.string().trim().max(120).optional(),
  sortBy: z.enum(Object.keys(LEAD_SORT_FIELDS)).default("created_at"),
  sortDirection: z.enum(["asc", "desc"]).default("desc")
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 40 })) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid lead list filters.", details: parsed.error.flatten() });
    return;
  }

  const { page, pageSize, search, status, source, sortBy, sortDirection } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = auth.supabase
    .from("leads")
    .select("id,name,email,phone,source,status,owner_id,team_id,created_at,updated_at", { count: "exact" });

  if (search) {
    const safeSearch = search.replace(/[%,]/g, "");
    query = query.or(`name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`);
  }

  if (status) query = query.eq("status", status);
  if (source) query = query.ilike("source", `%${source.replace(/[%]/g, "")}%`);

  const { data, error, count } = await query
    .order(LEAD_SORT_FIELDS[sortBy], { ascending: sortDirection === "asc" })
    .range(from, to);

  if (error) {
    res.status(500).json({ error: "Unable to load leads." });
    return;
  }

  res.status(200).json({
    leads: data,
    pagination: {
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.max(1, Math.ceil((count || 0) / pageSize))
    }
  });
}
