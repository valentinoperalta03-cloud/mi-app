import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import AdminDesktopHeader from "./admin-desktop-header";

export default async function AdminDesktopHeaderWrapper() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <AdminDesktopHeader />;

  const { data: club } = await supabase
    .from(DB_TABLES.clubs)
    .select("name,logo_url")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  return <AdminDesktopHeader logoUrl={club?.logo_url ?? null} clubName={club?.name ?? null} />;
}
