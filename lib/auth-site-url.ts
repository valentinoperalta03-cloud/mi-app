import type { NextRequest } from "next/server";

/** Origen canónico para redirects de auth (web + Capacitor). */
export function getAuthSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/**
 * Origen para OAuth: en previews de Vercel usa el host actual para que PKCE y callback coincidan.
 */
export function getAuthOriginFromRequest(request: NextRequest): string {
  const requestOrigin = new URL(request.url).origin.replace(/\/$/, "");
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (requestOrigin.includes("vercel.app") || requestOrigin.includes("localhost")) {
    return requestOrigin;
  }

  return fromEnv || requestOrigin;
}

export function getAuthCallbackPath(): string {
  return "/auth/callback";
}

export function getAuthCallbackUrl(): string {
  return `${getAuthSiteOrigin()}${getAuthCallbackPath()}`;
}

/** Deep link para OAuth en app nativa (registrar también en Supabase → Redirect URLs). */
export const NATIVE_AUTH_CALLBACK_URL = "com.padelibre.app://auth-callback";
