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

export async function requireApiProfile(req, res, allowedRoles = []) {
  const auth = await requireApiUser(req, res);
  if (!auth) return null;

  const { data: profile, error } = await auth.supabase
    .from("users")
    .select("id,name,email,role")
    .eq("id", auth.user.id)
    .single();

  if (error || !profile) {
    res.status(403).json({ error: "Profile not found or not visible." });
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    res.status(403).json({ error: "You do not have permission to access this resource." });
    return null;
  }

  return { ...auth, profile };
}
