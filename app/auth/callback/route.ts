import { type NextRequest, NextResponse } from "next/server";
import { resolvePostLoginPath } from "@/lib/auth-redirect";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { getAuthOriginFromRequest } from "@/lib/auth-site-url";
import { createSupabaseRouteHandlerClient } from "@/utils/supabase/route-handler";

type EmailOtpType =
  | "signup"
  | "recovery"
  | "invite"
  | "email"
  | "email_change"
  | "magiclink";

function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function redirectToLogin(
  origin: string,
  message: string,
  redirectWithCookies: (url: URL | string) => NextResponse
) {
  const url = new URL("/login", origin);
  url.searchParams.set("kind", "error");
  url.searchParams.set("message", message);
  return redirectWithCookies(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = getAuthOriginFromRequest(request);

  try {
    const oauthError = requestUrl.searchParams.get("error");
    const oauthDescription =
      requestUrl.searchParams.get("error_description")?.replace(/\+/g, " ") ?? null;

    const { supabase, redirectWithCookies } = createSupabaseRouteHandlerClient(request);

    if (oauthError) {
      const text =
        oauthDescription ??
        (oauthError === "access_denied"
          ? "Inicio de sesion cancelado."
          : "No se pudo completar el login.");
      return redirectToLogin(origin, text, redirectWithCookies);
    }

    const code = requestUrl.searchParams.get("code");
    const token_hash = requestUrl.searchParams.get("token_hash");
    const type = requestUrl.searchParams.get("type");
    const next = safeNextPath(requestUrl.searchParams.get("next"));

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        return redirectToLogin(
          origin,
          formatAuthErrorMessage(
            error.message || "No se pudo completar el inicio de sesion."
          ),
          redirectWithCookies
        );
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return redirectToLogin(origin, "No se pudo obtener la sesion.", redirectWithCookies);
      }

      const home = await resolvePostLoginPath(supabase, user.id, next);
      return redirectWithCookies(new URL(home, origin));
    }

    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash,
      });

      if (error) {
        return redirectToLogin(
          origin,
          formatAuthErrorMessage(
            error.message || "El enlace de verificacion no es valido o expiro."
          ),
          redirectWithCookies
        );
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return redirectToLogin(origin, "No se pudo obtener la sesion.", redirectWithCookies);
      }

      const home = await resolvePostLoginPath(supabase, user.id, next);
      return redirectWithCookies(new URL(home, origin));
    }

    return redirectToLogin(
      origin,
      "Enlace de autenticacion invalido o incompleto. Solicita uno nuevo desde login.",
      redirectWithCookies
    );
  } catch (err) {
    const { redirectWithCookies } = createSupabaseRouteHandlerClient(request);
    return redirectToLogin(
      origin,
      formatAuthErrorMessage(err instanceof Error ? err.message : "Error en autenticacion."),
      redirectWithCookies
    );
  }
}
