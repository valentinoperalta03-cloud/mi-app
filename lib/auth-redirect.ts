import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveHomePath(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tipo_usuario")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.tipo_usuario === "admin") {
    return "/admin/dashboard";
  }
  return "/feed";
}

export function isAdminPanelPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isJugadorAppPath(pathname: string): boolean {
  const roots = [
    "/feed",
    "/inicio",
    "/clubes",
    "/partidos",
    "/reservas",
    "/perfil",
    "/test",
  ];
  return roots.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPublicAuthPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}
