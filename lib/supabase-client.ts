import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/** Cliente Supabase para el browser / WebView de Capacitor (implicit flow; evita PKCE tras reload). */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("createSupabaseBrowserClient solo puede usarse en el cliente.");
  }

  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: "implicit",
        },
      }
    );
  }

  return browserClient;
}
