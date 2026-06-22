import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { importLeadRows } from "@/services/leadImportService";

const leadRowSchema = z.object({
  rowNumber: z.number().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  source: z.string().optional()
});

const importSchema = z.object({
  fileName: z.string().trim().max(180).optional(),
  rows: z.array(leadRowSchema).min(1).max(1000),
  duplicateActions: z.record(z.enum(["skip", "import"])).optional()
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 10 })) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid import payload.", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await importLeadRows(
      auth.supabase,
      auth.user.id,
      parsed.data.fileName,
      parsed.data.rows,
      parsed.data.duplicateActions || {}
    );
    res.status(200).json(result);
  } catch {
    res.status(500).json({ error: "Unable to import leads." });
  }
}
