import { z } from "zod";
import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email()
});

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 15 })) return;

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid profile data.", details: parsed.error.flatten() });
    return;
  }

  const { error } = await auth.supabase.from("users").upsert({
    id: auth.user.id,
    name: parsed.data.name,
    email: parsed.data.email,
    role: "agent"
  });

  if (error) {
    res.status(500).json({ error: "Unable to save profile." });
    return;
  }

  res.status(200).json({ ok: true });
}
