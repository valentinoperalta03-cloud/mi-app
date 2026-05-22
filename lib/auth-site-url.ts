/** Origen canónico para redirects de auth (web + Capacitor cargan el mismo dominio). */
export function getAuthSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export function getAuthCallbackPath(): string {
  return "/auth/callback";
}

export function getAuthCallbackUrl(): string {
  return `${getAuthSiteOrigin()}${getAuthCallbackPath()}`;
}

/** Deep link para OAuth en app nativa (registrar también en Supabase → Redirect URLs). */
export const NATIVE_AUTH_CALLBACK_URL = "com.padelibre.app://auth-callback";
