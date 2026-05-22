import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Supabase client for Route Handlers: PKCE y sesión se leen/escriben en cookies
 * de la misma respuesta HTTP (evita el fallo con Server Actions + window.location).
 */
export function createSupabaseRouteHandlerClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  function redirectWithCookies(url: URL | string) {
    return NextResponse.redirect(url, { headers: response.headers });
  }

  return { supabase, redirectWithCookies };
}
