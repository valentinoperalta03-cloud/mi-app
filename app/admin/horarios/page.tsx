import { redirect } from "next/navigation";
import Link from "next/link";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminTitle, adminSubtitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import HorariosClient from "./horarios-client";

export const dynamic = "force-dynamic";

export default async function AdminHorariosPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubIds.length) redirect("/admin/config");

  const clubId = ctx.clubIds[0];

  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("open_time")
    .eq("id", clubId)
    .maybeSingle();

  const openTime = String(
    (clubRow as { open_time?: string | null } | null)?.open_time ?? "09:00"
  ).trim().slice(0, 5) || "09:00";

  const { data: blocksRaw } = await supabase
    .from(DB_TABLES.clubScheduleBlocks)
    .select("day_of_week,blocked_time")
    .eq("club_id", clubId);

  const blocks = (blocksRaw ?? []) as Array<{ day_of_week: number; blocked_time: string }>;

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/config" />
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0585FC]`}>Configuración</p>
        <h1 className={adminTitle}>Horarios bloqueados</h1>
        <p className={adminSubtitle}>
          Bloqueá turnos específicos por día de la semana. Se aplica a todas las canchas del club.
        </p>
      </header>

      <div className="rounded-2xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
        <span className="font-semibold">Apertura del club:</span> {openTime} hs · turnos de 90 min hasta las 00:00.{" "}
        <Link href="/admin/config" className="underline underline-offset-2 opacity-70 hover:opacity-100">
          Cambiar apertura
        </Link>
      </div>

      <section className={`${adminCard} space-y-5`}>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Turnos por día</h2>
          <p className="text-sm text-slate-500">
            Tocá un turno para bloquearlo (rojo) o desbloquearlo (verde). Los cambios se guardan al instante.
          </p>
        </div>
        <HorariosClient clubId={clubId} openTime={openTime} initialBlocks={blocks} />
      </section>
    </div>
  );
}
