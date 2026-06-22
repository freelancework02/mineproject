import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

export function getSupabaseServerClient(accessToken) {
  const options = accessToken
    ? {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    : {};

  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    options
  );
}
