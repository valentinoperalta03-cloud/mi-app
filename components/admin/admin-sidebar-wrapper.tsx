import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getCurrentUser } from "@/lib/auth/current-user";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import AdminMobileTopBar from "./admin-mobile-topbar";
import AdminSidebar from "./admin-sidebar";

/** Reemplaza al viejo AdminDesktopHeaderWrapper: sigue siendo dueño de la topbar mobile además del sidebar desktop. */
export default async function AdminSidebarWrapper() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <AdminMobileTopBar logoUrl={null} />
        <AdminSidebar clubName={null} logoUrl={null} ownerName={null} ownerEmail={null} />
      </>
    );
  }

  const supabase = await createClient();
  const [ctx, { data: profile }] = await Promise.all([
    getOwnerAdminContext(),
    supabase.from(DB_TABLES.profiles).select("name").eq("user_id", user.id).maybeSingle(),
  ]);
  const club = ctx?.clubs[0] ?? null;
  const logoUrl = club?.logo_url ?? null;

  return (
    <>
      <AdminMobileTopBar logoUrl={logoUrl} />
      <AdminSidebar
        clubName={club?.name ?? null}
        logoUrl={logoUrl}
        ownerName={(profile as { name?: string | null } | null)?.name ?? null}
        ownerEmail={user.email ?? null}
      />
    </>
  );
}
