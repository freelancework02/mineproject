import { getSupabaseServerClient } from "./supabaseServer";

export function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export async function requireApiUser(req, res) {
  const token = getBearerToken(req);

  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return null;
  }

  const supabase = getSupabaseServerClient(token);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return null;
  }

  return { supabase, user: data.user };
}
