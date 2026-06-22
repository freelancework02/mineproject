import axios from "axios";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export async function authApi() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return axios.create({
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}
