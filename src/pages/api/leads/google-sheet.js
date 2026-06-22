import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";
import { googleSheetCsvUrl, parseCsvText, tableToLeads } from "@/utils/leadImport";

const sheetSchema = z.object({
  url: z.string().trim().url()
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

  const parsed = sheetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid Google Sheet URL." });
    return;
  }

  try {
    const csvUrl = googleSheetCsvUrl(parsed.data.url);
    const response = await fetch(csvUrl);

    if (!response.ok) {
      res.status(400).json({ error: "Unable to fetch the Google Sheet. Confirm it is shared for viewing." });
      return;
    }

    const csv = await response.text();
    const rows = tableToLeads(parseCsvText(csv), "Google Sheets");
    res.status(200).json({ rows, fileName: "Google Sheet Import" });
  } catch (error) {
    res.status(400).json({ error: error.message || "Unable to read Google Sheet." });
  }
}
