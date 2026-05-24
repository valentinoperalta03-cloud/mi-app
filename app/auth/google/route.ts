import { type NextRequest, NextResponse } from "next/server";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { getAuthOriginFromRequest, NATIVE_AUTH_CALLBACK_URL } from "@/lib/auth-site-url";
import { isIosIpadUserAgent } from "@/lib/ios-ipad";
import { createSupabaseRouteHandlerClient } from "@/utils/supabase/route-handler";

const IPAD_GOOGLE_HINT =
  "En iPad, Google puede abrir Safari. Si no podés completar el login, usá «Continuar con Apple» o email y contraseña.";

export async function GET(request: NextRequest) {
  try {
    const origin = getAuthOriginFromRequest(request);
    const getUrl = request.nextUrl.searchParams.get("getUrl") === "true";
    const redirectTo = getUrl ? NATIVE_AUTH_CALLBACK_URL : `${origin}/auth/callback`;
    const userAgent = request.headers.get("user-agent") ?? "";
    const isIpadClient = isIosIpadUserAgent(userAgent);

    const { supabase, redirectWithCookies, jsonWithCookies } =
      createSupabaseRouteHandlerClient(request);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error) {
      const base = formatAuthErrorMessage(error.message);
      const message = isIpadClient ? `${base} ${IPAD_GOOGLE_HINT}` : base;

      if (getUrl) {
        return jsonWithCookies({ error: true, message }, { status: 400 });
      }

      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("kind", "error");
      loginUrl.searchParams.set("message", message);
      return redirectWithCookies(loginUrl);
    }

    if (!data.url) {
      const message = isIpadClient
        ? `No se pudo iniciar sesión con Google. ${IPAD_GOOGLE_HINT}`
        : "No se pudo iniciar sesión con Google.";

      if (getUrl) {
        return jsonWithCookies({ error: true, message }, { status: 400 });
      }

      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("kind", "error");
      loginUrl.searchParams.set("message", message);
      return redirectWithCookies(loginUrl);
    }

    if (getUrl) {
      return jsonWithCookies({ url: data.url });
    }

    // Navegación completa del WebView a Google OAuth (requerido por Supabase PKCE).
    return redirectWithCookies(data.url);
  } catch (err) {
    const origin = getAuthOriginFromRequest(request);
    const message = formatAuthErrorMessage(
      err instanceof Error ? err.message : "Error al iniciar con Google."
    );
    const getUrl = request.nextUrl.searchParams.get("getUrl") === "true";

    if (getUrl) {
      const { jsonWithCookies } = createSupabaseRouteHandlerClient(request);
      return jsonWithCookies({ error: true, message }, { status: 500 });
    }

    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("kind", "error");
    loginUrl.searchParams.set("message", message);
    return NextResponse.redirect(loginUrl);
  }
}
