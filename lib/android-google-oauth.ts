import { Browser } from "@capacitor/browser";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { resolveHomePath } from "@/lib/auth-redirect";
import { NATIVE_AUTH_CALLBACK_URL } from "@/lib/auth-site-url";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

const NATIVE_CALLBACK_PREFIX = NATIVE_AUTH_CALLBACK_URL.split("?")[0];

export type NativeOAuthCallbackParams = {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
};

export function parseNativeOAuthCallback(url: string): NativeOAuthCallbackParams | null {
  if (!url.startsWith(NATIVE_CALLBACK_PREFIX)) {
    return null;
  }

  const queryStart = url.indexOf("?");
  const search = queryStart >= 0 ? url.slice(queryStart) : "";
  const params = new URLSearchParams(search);

  return {
    code: params.get("code"),
    error: params.get("error"),
    errorDescription: params.get("error_description"),
  };
}

export async function startAndroidGoogleOAuth(): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: NATIVE_AUTH_CALLBACK_URL,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    return { ok: false, message: formatAuthErrorMessage(error.message) };
  }

  if (!data.url) {
    return { ok: false, message: "No se pudo iniciar sesión con Google." };
  }

  await Browser.open({ url: data.url });
  return { ok: true };
}

export async function completeAndroidGoogleOAuthFromDeepLink(
  url: string
): Promise<{ ok: true; redirectTo: string } | { ok: false; redirectTo: string }> {
  const params = parseNativeOAuthCallback(url);
  if (!params) {
    return { ok: false, redirectTo: "/login" };
  }

  if (params.error) {
    const message =
      params.errorDescription?.replace(/\+/g, " ") ??
      (params.error === "access_denied"
        ? "Inicio de sesión cancelado."
        : "No se pudo completar el login.");
    return {
      ok: false,
      redirectTo: `/login?kind=error&message=${encodeURIComponent(message)}`,
    };
  }

  if (!params.code) {
    return {
      ok: false,
      redirectTo: `/login?kind=error&message=${encodeURIComponent("Enlace de autenticación incompleto.")}`,
    };
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.exchangeCodeForSession(params.code);

  if (error) {
    return {
      ok: false,
      redirectTo: `/login?kind=error&message=${encodeURIComponent(
        formatAuthErrorMessage(error.message || "No se pudo completar el inicio de sesión.")
      )}`,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      redirectTo: `/login?kind=error&message=${encodeURIComponent("No se pudo obtener la sesión.")}`,
    };
  }

  const home = await resolveHomePath(supabase, user.id);
  return { ok: true, redirectTo: home };
}
