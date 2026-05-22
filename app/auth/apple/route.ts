import { type NextRequest, NextResponse } from "next/server";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { getAuthOriginFromRequest } from "@/lib/auth-site-url";
import { createSupabaseRouteHandlerClient } from "@/utils/supabase/route-handler";

export async function GET(request: NextRequest) {
  try {
    const origin = getAuthOriginFromRequest(request);
    const redirectTo = `${origin}/auth/callback`;

    const { supabase, redirectWithCookies } = createSupabaseRouteHandlerClient(request);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo,
        scopes: "name email",
      },
    });

    if (error) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("kind", "error");
      loginUrl.searchParams.set("message", formatAuthErrorMessage(error.message));
      return redirectWithCookies(loginUrl);
    }

    if (!data.url) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("kind", "error");
      loginUrl.searchParams.set("message", "No se pudo iniciar sesión con Apple.");
      return redirectWithCookies(loginUrl);
    }

    return redirectWithCookies(data.url);
  } catch (err) {
    const origin = getAuthOriginFromRequest(request);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("kind", "error");
    loginUrl.searchParams.set(
      "message",
      formatAuthErrorMessage(err instanceof Error ? err.message : "Error al iniciar con Apple.")
    );
    return NextResponse.redirect(loginUrl);
  }
}
