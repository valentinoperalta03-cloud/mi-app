/** Rutas principales del jugador: se precargan tras login / al abrir el shell player. */
export const PLAYER_SHELL_ROUTES = ["/home", "/clubes", "/comunidad", "/perfil"] as const;

export type PlayerShellRoute = (typeof PLAYER_SHELL_ROUTES)[number];

/** Calienta caché de datos del home (API server con cookies de sesión). */
export function prefetchPlayerHomeData(): void {
  if (typeof window === "undefined") return;

  void fetch("/api/prefetch", {
    credentials: "include",
    cache: "no-store",
  }).catch(() => {
    // Best-effort; la pantalla carga igual si falla.
  });
}
