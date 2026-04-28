import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type CreateSupabaseServerClientOptions = {
  /**
   * true: Server Actions, Route Handlers — las cookies de sesion deben persistirse.
   * false (default): Server Components — si set falla (solo lectura), se ignora.
   */
  allowCookieWrites?: boolean;
};

export async function createClient(options?: CreateSupabaseServerClientOptions) {
  const allowCookieWrites = options?.allowCookieWrites ?? false;
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          if (allowCookieWrites) {
            cookiesToSet.forEach(({ name, value, options: opts }) =>
              cookieStore.set(name, value, opts)
            );
            return;
          }
          try {
            cookiesToSet.forEach(({ name, value, options: opts }) =>
              cookieStore.set(name, value, opts)
            );
          } catch {
            // Server Components u otros contextos donde no se pueden fijar cookies.
          }
        },
      },
    }
  );
}

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
