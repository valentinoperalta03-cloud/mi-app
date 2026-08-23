import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import TorneoForm from "../torneo-form";

export const dynamic = "force-dynamic";

export default async function AdminTorneoNuevoPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");

  const clubId = ctx.clubIds[0]!;
  const { data: courtRows } = await supabase
    .from(DB_TABLES.courts)
    .select("id, name")
    .eq("club_id", clubId)
    .order("name", { ascending: true });
  const courts = (courtRows ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6 md:pb-10">
      <Link
        href="/admin/torneos"
        className="inline-flex items-center gap-1 text-sm font-medium text-[#0461C4] dark:text-sky-400"
      >
        <ChevronLeft size={18} />
        Volver
      </Link>
      <h1 className={`mt-4 ${adminTitle}`}>Crear torneo</h1>
      <TorneoForm clubId={clubId} courts={courts} />
    </div>
  );
}
