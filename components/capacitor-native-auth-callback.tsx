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

const HANDLED_OAUTH_URLS_KEY = "padelibre:handled-oauth-urls";

function getHandledOAuthUrls(): Set<string> {
  try {
    const raw = sessionStorage.getItem(HANDLED_OAUTH_URLS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function markOAuthUrlHandled(url: string): void {
  try {
    const handled = getHandledOAuthUrls();
    handled.add(url);
    sessionStorage.setItem(HANDLED_OAUTH_URLS_KEY, JSON.stringify([...handled]));
  } catch {
    // sessionStorage unavailable
  }
}

function wasOAuthUrlHandled(url: string): boolean {
  return getHandledOAuthUrls().has(url);
}

// ─── Deep link (Universal Link / App Link) tracking ──────────────────────────

const HANDLED_DEEPLINK_KEY = "padelibre:handled-deeplinks";

function getHandledDeepLinks(): Set<string> {
  try {
    const raw = sessionStorage.getItem(HANDLED_DEEPLINK_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function markDeepLinkHandled(url: string): void {
  try {
    const handled = getHandledDeepLinks();
    handled.add(url);
    sessionStorage.setItem(HANDLED_DEEPLINK_KEY, JSON.stringify([...handled]));
  } catch {}
}

function wasDeepLinkHandled(url: string): boolean {
  return getHandledDeepLinks().has(url);
}

// ─── Deep link parser ─────────────────────────────────────────────────────────

const PADELIBRE_HOSTS = new Set(["www.padelibre.online", "padelibre.online"]);
// Paths que no deben ser interceptados (los maneja el flujo de auth normal)
const SKIP_PATHS = new Set(["/", "/login", "/verificar-email", "/onboarding", "/bienvenida"]);

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
  if (wasOAuthUrlHandled(url)) {
    return;
  }
  markOAuthUrlHandled(url);

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
      .then((launch) => {
        if (!launch?.url) return;

        // Universal Link de padelibre.online
        const deepPath = extractDeepLinkPath(launch.url);
        if (deepPath && !wasDeepLinkHandled(launch.url)) {
          markDeepLinkHandled(launch.url);
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
