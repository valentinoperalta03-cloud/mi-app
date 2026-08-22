import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Trophy } from "lucide-react";
import AdminGuideBox from "@/components/admin/admin-guide-box";
import AdminPageHeader from "@/components/admin/admin-page-header";
import {
  adminAccentBar,
  adminBadgeNeutral,
  adminCard,
  adminCTAPrimary,
  adminSectionLabel,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_TYPE_OPTIONS } from "@/lib/tournament-constants";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminTorneosPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");

  const { data: rows } = await supabase
    .from(DB_TABLES.tournaments)
    .select("id, name, tournament_type, start_date, end_date, status, max_pairs, club_id")
    .in("club_id", ctx.clubIds)
    .order("start_date", { ascending: false });

  const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);
  const { data: counts } = ids.length
    ? await supabase
        .from(DB_TABLES.tournamentRegistrations)
        .select("tournament_id")
        .in("tournament_id", ids)
        .eq("payment_status", "approved")
        .eq("waitlist", false)
    : { data: [] };
  const countBy = new Map<string, number>();
  for (const r of (counts ?? []) as { tournament_id: string }[]) {
    countBy.set(r.tournament_id, (countBy.get(r.tournament_id) ?? 0) + 1);
  }

  const typeLabel = (t: string) => TOURNAMENT_TYPE_OPTIONS.find((o) => o.value === t)?.badge ?? t;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        kicker="Gestión de juego"
        title="Torneos"
        subtitle="Americanos, llaves y peñas"
        action={
          <Link
            href="/admin/torneos/nuevo"
            className={`inline-flex shrink-0 items-center gap-1.5 ${adminCTAPrimary}`}
          >
            <Plus size={18} />
            Crear
          </Link>
        }
      />

      <AdminGuideBox title="¿Cómo crear un torneo?">
        <ol className="list-decimal space-y-1.5 pl-4 text-[var(--text-secondary)]">
          <li>Creá el torneo con nombre, fecha, precio de inscripción y cantidad máxima de parejas.</li>
          <li>Publicalo para que los jugadores se inscriban desde la app y paguen online.</li>
          <li>Una vez cerradas las inscripciones, generá el fixture automáticamente.</li>
          <li>Cargá los resultados de cada partido para que el cuadro se actualice en tiempo real.</li>
        </ol>
      </AdminGuideBox>

      <section>
        <h2 className={`mb-3 ${adminSectionLabel}`}>Listado</h2>
        <ul className="space-y-2">
          {((rows ?? []) as Array<{
            id: string;
            name: string;
            tournament_type: string;
            start_date: string;
            end_date: string;
            status: string;
            max_pairs: number;
          }>).length === 0 ? (
            <li className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
              <Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Todavía no hay torneos.
            </li>
          ) : null}
          {((rows ?? []) as Array<{
            id: string;
            name: string;
            tournament_type: string;
            start_date: string;
            end_date: string;
            status: string;
            max_pairs: number;
          }>).map((t) => {
            const c = countBy.get(t.id) ?? 0;
            return (
              <li key={t.id}>
                <Link
                  href={`/admin/torneos/${t.id}`}
                  className={`${adminCard} flex flex-col gap-1 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between ${t.status === "in_progress" ? adminAccentBar : ""}`}
                >
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{t.name}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {typeLabel(t.tournament_type)} · {t.start_date} → {t.end_date}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={adminBadgeNeutral}>
                      {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
                    </span>
                    <span className="text-[var(--text-secondary)]">
                      {c}/{t.max_pairs} parejas
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
