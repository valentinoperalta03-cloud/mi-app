import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import AdminMobileTopBar from "./admin-mobile-topbar";
import AdminSidebar from "./admin-sidebar";

/** Reemplaza al viejo AdminDesktopHeaderWrapper: sigue siendo dueño de la topbar mobile además del sidebar desktop. */
export default async function AdminSidebarWrapper() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <AdminMobileTopBar logoUrl={null} />
        <AdminSidebar clubName={null} logoUrl={null} ownerName={null} ownerEmail={null} />
      </>
    );
  }

  const [{ data: club }, { data: profile }] = await Promise.all([
    supabase.from(DB_TABLES.clubs).select("name,logo_url").eq("owner_id", user.id).limit(1).maybeSingle(),
    supabase.from(DB_TABLES.profiles).select("name").eq("user_id", user.id).maybeSingle(),
  ]);
  const logoUrl = (club as { logo_url?: string | null } | null)?.logo_url ?? null;

  return (
    <>
      <AdminMobileTopBar logoUrl={logoUrl} />
      <AdminSidebar
        clubName={(club as { name?: string | null } | null)?.name ?? null}
        logoUrl={logoUrl}
        ownerName={(profile as { name?: string | null } | null)?.name ?? null}
        ownerEmail={user.email ?? null}
      />
    </>
  );
}
