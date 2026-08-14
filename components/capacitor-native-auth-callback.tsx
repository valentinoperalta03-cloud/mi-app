"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import {
  completeNativeOAuthFromDeepLink,
  parseNativeOAuthCallback,
} from "@/lib/native-oauth";

// ─── OAuth tracking ───────────────────────────────────────────────────────────
// Uses Preferences (native SQLite storage) instead of sessionStorage.
// sessionStorage is cleared when Samsung kills the WebView background process,
// causing handled OAuth URLs to appear unhandled on the next resume, which
// triggers a double-execution of the OAuth completion flow and breaks sign-in.

const HANDLED_OAUTH_URLS_KEY = "padelibre:handled-oauth-urls";

async function getHandledOAuthUrls(): Promise<Set<string>> {
  try {
    const { value } = await Preferences.get({ key: HANDLED_OAUTH_URLS_KEY });
    if (!value) return new Set();
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

async function markOAuthUrlHandled(url: string): Promise<void> {
  try {
    const handled = await getHandledOAuthUrls();
    handled.add(url);
    await Preferences.set({ key: HANDLED_OAUTH_URLS_KEY, value: JSON.stringify([...handled]) });
  } catch {
    // Preferences unavailable in web preview
  }
}

async function wasOAuthUrlHandled(url: string): Promise<boolean> {
  return (await getHandledOAuthUrls()).has(url);
}

// ─── Deep link (Universal Link / App Link) tracking ──────────────────────────

const HANDLED_DEEPLINK_KEY = "padelibre:handled-deeplinks";

async function getHandledDeepLinks(): Promise<Set<string>> {
  try {
    const { value } = await Preferences.get({ key: HANDLED_DEEPLINK_KEY });
    if (!value) return new Set();
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

async function markDeepLinkHandled(url: string): Promise<void> {
  try {
    const handled = await getHandledDeepLinks();
    handled.add(url);
    await Preferences.set({ key: HANDLED_DEEPLINK_KEY, value: JSON.stringify([...handled]) });
  } catch {}
}

async function wasDeepLinkHandled(url: string): Promise<boolean> {
  return (await getHandledDeepLinks()).has(url);
}

// ─── Deep link parser ─────────────────────────────────────────────────────────

const PADELIBRE_HOSTS = new Set(["www.padelibre.online", "padelibre.online"]);
// Paths que no deben ser interceptados (los maneja el flujo de auth normal)
const SKIP_PATHS = new Set(["/", "/login", "/verificar-email", "/completar-perfil", "/bienvenida"]);

function extractDeepLinkPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (!PADELIBRE_HOSTS.has(parsed.hostname)) return null;
    if (SKIP_PATHS.has(parsed.pathname)) return null;
    if (parsed.pathname.startsWith("/auth/")) return null;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return null;
  }
}

// ─── OAuth helpers ────────────────────────────────────────────────────────────

function redirectToLoginError(message: string) {
  const params = new URLSearchParams({ kind: "error", message });
  window.location.href = `/login?${params.toString()}`;
}

async function handleOAuthDeepLink(url: string) {
  if (!parseNativeOAuthCallback(url)) {
    return;
  }

  // getLaunchUrl() persiste en iOS y se re-ejecuta en cada recarga del WebView.
  if (await wasOAuthUrlHandled(url)) {
    return;
  }
  await markOAuthUrlHandled(url);

  try {
    await Browser.close();
  } catch {
    // Browser sheet already closed
  }

  const result = await completeNativeOAuthFromDeepLink(url);
  window.location.href = result.redirectTo;
}

async function consumePendingOAuthCallback(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: "pendingOAuthCallback" });
    if (value) {
      await Preferences.remove({ key: "pendingOAuthCallback" });
    }
    return value;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CapacitorNativeAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let removeListener: (() => void) | undefined;

    // 1. Pending OAuth callback (guardado por SceneDelegate antes de que React estuviera listo)
    void consumePendingOAuthCallback().then((pendingUrl) => {
      if (pendingUrl) {
        return handleOAuthDeepLink(pendingUrl);
      }
    });

    // 2. Cold start — puede ser OAuth o Universal Link
    void App.getLaunchUrl()
      .then(async (launch) => {
        if (!launch?.url) return;

        // Universal Link de padelibre.online
        const deepPath = extractDeepLinkPath(launch.url);
        if (deepPath && !(await wasDeepLinkHandled(launch.url))) {
          await markDeepLinkHandled(launch.url);
          router.push(deepPath);
          return;
        }

        // OAuth callback
        return handleOAuthDeepLink(launch.url);
      })
      .catch((err) => {
        console.error("[CapacitorNativeAuthCallback] getLaunchUrl failed", err);
      });

    // 3. Warm return — app ya corriendo
    void App.addListener("appUrlOpen", async (event) => {
      try {
        // Universal Link de padelibre.online
        const deepPath = extractDeepLinkPath(event.url);
        if (deepPath) {
          router.push(deepPath);
          return;
        }

        // OAuth callback
        await handleOAuthDeepLink(event.url);
      } catch (err) {
        console.error("[CapacitorNativeAuthCallback] appUrlOpen failed", err);
        const message =
          err instanceof Error ? err.message : "No se pudo completar el inicio de sesión.";
        redirectToLoginError(message);
      }
    })
      .then((listener) => {
        removeListener = () => listener.remove();
      })
      .catch((err) => {
        console.error("[CapacitorNativeAuthCallback] failed to register appUrlOpen listener", err);
      });

    return () => removeListener?.();
  }, [router]);

  return null;
}
