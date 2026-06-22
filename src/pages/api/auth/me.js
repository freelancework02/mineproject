import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";

export default async function handler(req, res) {
  if (!rateLimit(req, res)) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const { data: profile, error } = await auth.supabase
    .from("users")
    .select("id,name,email,role,created_at,updated_at")
    .eq("id", auth.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    res.status(500).json({ error: "Unable to load profile." });
    return;
  }

  res.status(200).json({ user: auth.user, profile: profile || null });
}
