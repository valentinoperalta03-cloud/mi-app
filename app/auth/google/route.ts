import { type NextRequest, NextResponse } from "next/server";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { getAuthOriginFromRequest } from "@/lib/auth-site-url";
import { isIosIpadUserAgent } from "@/lib/ios-ipad";
import { createSupabaseRouteHandlerClient } from "@/utils/supabase/route-handler";

const IPAD_GOOGLE_HINT =
  "En iPad, Google puede abrir Safari. Si no podés completar el login, usá «Continuar con Apple» o email y contraseña.";

export async function GET(request: NextRequest) {
  try {
    const origin = getAuthOriginFromRequest(request);
    const getUrl = request.nextUrl.searchParams.get("getUrl") === "true";
    const userAgent = request.headers.get("user-agent") ?? "";
    const isIpadClient = isIosIpadUserAgent(userAgent);

    // Android nativo: OAuth + PKCE en el WebView (Custom Tab no comparte cookies con el servidor).
    if (getUrl) {
      return NextResponse.json(
        {
          error: true,
          message:
            "En Android, el login con Google debe iniciarse desde el cliente de la app (skipBrowserRedirect).",
        },
        { status: 400 }
      );
    }

    const redirectTo = `${origin}/auth/callback`;

    const { supabase, redirectWithCookies } = createSupabaseRouteHandlerClient(request);

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

      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("kind", "error");
      loginUrl.searchParams.set("message", message);
      return redirectWithCookies(loginUrl);
    }

    if (!data.url) {
      const message = isIpadClient
        ? `No se pudo iniciar sesión con Google. ${IPAD_GOOGLE_HINT}`
        : "No se pudo iniciar sesión con Google.";

      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("kind", "error");
      loginUrl.searchParams.set("message", message);
      return redirectWithCookies(loginUrl);
    }

    // Navegación completa del WebView a Google OAuth (requerido por Supabase PKCE en iOS/web).
    return redirectWithCookies(data.url);
  } catch (err) {
    const origin = getAuthOriginFromRequest(request);
    const message = formatAuthErrorMessage(
      err instanceof Error ? err.message : "Error al iniciar con Google."
    );

    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("kind", "error");
    loginUrl.searchParams.set("message", message);
    return NextResponse.redirect(loginUrl);
  }
}
