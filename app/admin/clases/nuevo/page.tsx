import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import ClaseForm from "../clase-form";
import AddCoachForm from "../add-coach-form";

export const dynamic = "force-dynamic";

export default async function AdminClaseNuevoPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");
  const clubId = ctx.clubIds[0]!;

  const [{ data: courts }, { data: coaches }] = await Promise.all([
    supabase.from(DB_TABLES.courts).select("id, name").eq("club_id", clubId).order("name"),
    supabase.from(DB_TABLES.practiceCoaches).select("id, name").eq("club_id", clubId).order("name"),
  ]);

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6 md:pb-10">
      <Link
        href="/admin/clases"
        className="inline-flex items-center gap-1 text-sm font-medium text-[#0461C4] dark:text-sky-400"
      >
        <ChevronLeft size={18} />
        Volver
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Nueva clase</h1>
      <AddCoachForm clubId={clubId} />
      <ClaseForm
        clubId={clubId}
        courts={((courts ?? []) as { id: string; name: string }[])}
        coaches={((coaches ?? []) as { id: string; name: string }[])}
      />
    </div>
  );
}
