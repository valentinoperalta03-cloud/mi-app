import { Browser } from "@capacitor/browser";
import type { Provider } from "@supabase/supabase-js";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { resolveHomePath } from "@/lib/auth-redirect";
import { NATIVE_AUTH_CALLBACK_URL } from "@/lib/auth-site-url";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

const NATIVE_CALLBACK_PREFIX = NATIVE_AUTH_CALLBACK_URL.split("?")[0];

export type NativeOAuthCallbackParams = {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  errorDescription: string | null;
};

export function parseNativeOAuthCallback(url: string): NativeOAuthCallbackParams | null {
  if (!url.startsWith(NATIVE_CALLBACK_PREFIX)) {
    return null;
  }
  const hashStart = url.indexOf("#");
  const queryStart = url.indexOf("?");
  const search = queryStart >= 0 ? url.slice(queryStart, hashStart >= 0 ? hashStart : undefined) : "";
  const hash = hashStart >= 0 ? url.slice(hashStart + 1) : "";
  const queryParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash);
  return {
    code: queryParams.get("code"),
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    error: queryParams.get("error") ?? hashParams.get("error"),
    errorDescription: queryParams.get("error_description") ?? hashParams.get("error_description"),
  };
}

async function startNativeOAuth(
  provider: Provider,
  options?: { queryParams?: Record<string, string>; scopes?: string }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createSupabaseBrowserClient();

  let oauthUrl: string | null = null;

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: NATIVE_AUTH_CALLBACK_URL,
        skipBrowserRedirect: true,
        queryParams: options?.queryParams,
        scopes: options?.scopes,
      },
    });

    if (error) {
      return { ok: false, message: formatAuthErrorMessage(error.message) };
    }

    oauthUrl = data?.url ?? null;
  } catch (err) {
    console.error("[NativeOAuth] signInWithOAuth error:", err);
    return {
      ok: false,
      message: `Error al generar URL de autenticación: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!oauthUrl) {
    return {
      ok: false,
      message: `No se pudo iniciar sesión con ${provider === "apple" ? "Apple" : "Google"}.`,
    };
  }

  try {
    await Browser.open({ url: oauthUrl });
  } catch (err) {
    console.error("[NativeOAuth] Browser.open error:", err);
    return {
      ok: false,
      message: `No se pudo abrir el navegador: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { ok: true };
}

export function startNativeGoogleOAuth(): Promise<{ ok: true } | { ok: false; message: string }> {
  return startNativeOAuth("google", {
    queryParams: {
      access_type: "offline",
      prompt: "select_account",
    },
  });
}

export function startNativeAppleOAuth(): Promise<{ ok: true } | { ok: false; message: string }> {
  return startNativeOAuth("apple", { scopes: "name email" });
}

export async function completeNativeOAuthFromDeepLink(
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
  const supabase = createSupabaseBrowserClient();

  if (params.accessToken && params.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) {
      return {
        ok: false,
        redirectTo: `/login?kind=error&message=${encodeURIComponent(
          formatAuthErrorMessage(error.message || "No se pudo completar el inicio de sesión.")
        )}`,
      };
    }
  } else if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      return {
        ok: false,
        redirectTo: `/login?kind=error&message=${encodeURIComponent(
          formatAuthErrorMessage(error.message || "No se pudo completar el inicio de sesión.")
        )}`,
      };
    }
  } else {
    return {
      ok: false,
      redirectTo: `/login?kind=error&message=${encodeURIComponent("Enlace de autenticación incompleto.")}`,
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
