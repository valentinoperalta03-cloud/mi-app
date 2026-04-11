import { type NextRequest, NextResponse } from "next/server";
import { resolveHomePath } from "@/lib/auth-redirect";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/utils/supabase/server";

type EmailOtpType =
  | "signup"
  | "recovery"
  | "invite"
  | "email"
  | "email_change"
  | "magiclink";

function redirectToLogin(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("kind", "error");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const oauthError = requestUrl.searchParams.get("error");
  const oauthDescription =
    requestUrl.searchParams.get("error_description")?.replace(/\+/g, " ") ?? null;

  if (oauthError) {
    const text =
      oauthDescription ??
      (oauthError === "access_denied"
        ? "Inicio de sesion cancelado."
        : "No se pudo completar el login.");
    return redirectToLogin(origin, text);
  }

  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  const supabase = await createClient({ allowCookieWrites: true });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return redirectToLogin(
        origin,
        formatAuthErrorMessage(
          error.message || "No se pudo completar el inicio de sesion."
        )
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return redirectToLogin(origin, "No se pudo obtener la sesion.");
    }

    const home = await resolveHomePath(supabase, user.id);
    return NextResponse.redirect(new URL(home, origin));
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
        )
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return redirectToLogin(origin, "No se pudo obtener la sesion.");
    }

    const home = await resolveHomePath(supabase, user.id);
    return NextResponse.redirect(new URL(home, origin));
  }

  return redirectToLogin(
    origin,
    "Enlace de autenticacion invalido o incompleto. Solicita uno nuevo desde login."
  );
}
