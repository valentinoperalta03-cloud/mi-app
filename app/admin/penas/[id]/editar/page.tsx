import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import PenaForm, { type PenaFormData } from "../../pena-form";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AdminPenaEditarPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: p } = await supabase
    .from(DB_TABLES.penas)
    .select(
      "id, club_id, name, description, what_includes, date, start_time, duration_minutes, level, game_format, max_players, price_per_player, accepts_mp, accepts_cash, accepts_transfer, transfer_alias, cancellation_hours, status"
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) redirect("/admin/penas");

  const pena = p as PenaFormData & { club_id: string; status: string };
  if (!ctx.clubIds.includes(pena.club_id)) redirect("/admin/penas");
  if (pena.status !== "draft") redirect(`/admin/penas/${id}`);

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6 md:pb-10">
      <Link
        href={`/admin/penas/${id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#0461C4] dark:text-sky-400"
      >
        <ChevronLeft size={18} />
        Volver
      </Link>
      <h1 className={`mt-4 ${adminTitle}`}>Editar peña</h1>
      <PenaForm mode="edit" clubId={pena.club_id} pena={pena} />
    </div>
  );
}
