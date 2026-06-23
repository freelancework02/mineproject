import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";

const querySchema = z.object({
  leadId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

const noteSchema = z.object({
  leadId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000)
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 50 })) return;

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid notes query.", details: parsed.error.flatten() });
      return;
    }

    const { leadId, page, pageSize } = parsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = auth.supabase
      .from("notes")
      .select("id,lead_id,body,created_by,created_at,updated_at,creator:users!notes_created_by_fkey(id,name,email)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (leadId) query = query.eq("lead_id", leadId);

    const { data, error, count } = await query;
    if (error) {
      res.status(500).json({ error: "Unable to load notes." });
      return;
    }

    res.status(200).json({
      notes: data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / pageSize))
      }
    });
    return;
  }

  if (req.method === "POST") {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid note.", details: parsed.error.flatten() });
      return;
    }

    const { data: note, error } = await auth.supabase
      .from("notes")
      .insert({
        lead_id: parsed.data.leadId,
        body: parsed.data.body,
        created_by: auth.user.id
      })
      .select("id,lead_id,body,created_by,created_at,updated_at,creator:users!notes_created_by_fkey(id,name,email)")
      .single();

    if (error) {
      res.status(403).json({ error: "Unable to add note for this lead." });
      return;
    }

    await auth.supabase.from("lead_activities").insert({
      lead_id: parsed.data.leadId,
      activity_type: "note",
      activity_data: {
        note_id: note.id,
        body: parsed.data.body
      },
      created_by: auth.user.id
    });

    res.status(201).json({ note });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed." });
}
