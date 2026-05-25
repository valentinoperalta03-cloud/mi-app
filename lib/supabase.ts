import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cached) return cached;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  cached = createClient(supabaseUrl, supabaseAnonKey);
  return cached;
}

export function getSupabase(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Missing Supabase environment variables.");
  }
  return client;
}

/** Compatibilidad con imports existentes (`supabase.from(...)`). */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabase();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
