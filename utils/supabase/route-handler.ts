import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Supabase client for Route Handlers: PKCE y sesión en cookies de la respuesta HTTP.
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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  function appendPkceCookies(target: NextResponse) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      target.headers.append("Set-Cookie", cookie);
    }
    return target;
  }

  /** Solo copia Set-Cookie (no headers internos de Next.js → evita 500 en redirect externo). */
  function redirectWithCookies(url: URL | string) {
    return appendPkceCookies(NextResponse.redirect(url));
  }

  function jsonWithCookies(body: unknown, init?: ResponseInit) {
    return appendPkceCookies(NextResponse.json(body, init));
  }

  return { supabase, redirectWithCookies, jsonWithCookies };
}
