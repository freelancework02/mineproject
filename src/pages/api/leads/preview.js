import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { buildLeadPreview } from "@/services/leadImportService";

const leadRowSchema = z.object({
  rowNumber: z.number().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  source: z.string().optional()
});

const previewSchema = z.object({
  rows: z.array(leadRowSchema).min(1).max(1000)
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 20 })) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid import preview payload.", details: parsed.error.flatten() });
    return;
  }

  try {
    const preview = await buildLeadPreview(auth.supabase, parsed.data.rows);
    res.status(200).json(preview);
  } catch {
    res.status(500).json({ error: "Unable to preview leads." });
  }
}
