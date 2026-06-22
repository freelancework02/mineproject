import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";

const templateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  message: z.string().trim().min(1).max(1600)
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 40 })) return;

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const { data, error } = await auth.supabase
      .from("sms_templates")
      .select("id,name,message,created_by,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: "Unable to load SMS templates." });
      return;
    }

    res.status(200).json({ templates: data });
    return;
  }

  if (req.method === "POST") {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid SMS template.", details: parsed.error.flatten() });
      return;
    }

    const { data, error } = await auth.supabase
      .from("sms_templates")
      .insert({
        ...parsed.data,
        created_by: auth.user.id
      })
      .select("id,name,message,created_by,created_at,updated_at")
      .single();

    if (error) {
      res.status(500).json({ error: "Unable to create SMS template." });
      return;
    }

    res.status(201).json({ template: data });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed." });
}
