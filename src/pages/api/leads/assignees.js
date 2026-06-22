import { requireApiUser } from "@/lib/apiAuth";
import { rateLimit } from "@/lib/rateLimit";

export default async function handler(req, res) {
  if (!rateLimit(req, res, { limit: 30 })) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const auth = await requireApiUser(req, res);
  if (!auth) return;

  const [usersResult, teamsResult] = await Promise.all([
    auth.supabase.from("users").select("id,name,email,role").order("name", { ascending: true }),
    auth.supabase.from("teams").select("id,name").order("name", { ascending: true })
  ]);

  if (usersResult.error || teamsResult.error) {
    res.status(500).json({ error: "Unable to load assignees." });
    return;
  }

  res.status(200).json({
    users: usersResult.data,
    teams: teamsResult.data
  });
}
