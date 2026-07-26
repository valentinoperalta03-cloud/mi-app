import Link from "next/link";
import { redirect } from "next/navigation";
import { Info, Plus, Trophy } from "lucide-react";
import {
  adminAccentBar,
  adminBadgeNeutral,
  adminCard,
  adminCTAPrimary,
  adminSectionLabel,
  adminSubtitle,
  adminTip,
  adminTitle,
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
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 md:pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={adminTitle}>Torneos</h1>
          <p className={`mt-1 ${adminSubtitle}`}>Creá y gestioná torneos para tu club.</p>
        </div>
        <Link
          href="/admin/torneos/nuevo"
          className={`inline-flex shrink-0 items-center gap-1.5 ${adminCTAPrimary}`}
        >
          <Plus size={18} />
          Crear
        </Link>
      </div>

      {/* Sección de información */}
      <details className="group mt-6 overflow-hidden rounded-3xl border border-sky-200 bg-sky-100 dark:border-sky-800/60 dark:bg-sky-900/25">
        <summary className="flex cursor-pointer select-none items-center gap-2.5 px-5 py-4 text-sm font-semibold text-sky-900 marker:content-none dark:text-sky-100">
          <Info size={18} className="shrink-0 text-sky-600 dark:text-sky-400" />
          ¿Cómo funciona la sección de torneos?
          <span className="ml-auto text-xs font-normal text-sky-600 dark:text-sky-400 group-open:hidden">Ver guía</span>
          <span className="ml-auto text-xs font-normal text-sky-600 dark:text-sky-400 hidden group-open:inline">Cerrar</span>
        </summary>
        <div className="space-y-5 border-t border-sky-200/60 px-5 pb-5 pt-4 text-sm text-[var(--text-secondary)] dark:border-sky-800/40">

          <div>
            <p className="font-bold text-[var(--text-primary)]">¿Qué es un torneo en PadeLibre?</p>
            <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
              Un torneo te permite organizar competencias para los jugadores de tu club. Los jugadores se inscriben y pagan a través de la app. Vos controlás el fixture y cargás los resultados.
            </p>
          </div>

          <div>
            <p className="font-bold text-[var(--text-primary)]">Tipos de torneo</p>
            <ul className="mt-1.5 space-y-1.5 text-[var(--text-secondary)]">
              <li><span className="font-semibold">🏆 Americano:</span> Todas las parejas juegan entre sí. Gana quien más puntos acumule. Ideal para grupos pequeños (hasta 8 parejas).</li>
              <li><span className="font-semibold">⚡ Eliminación directa:</span> El que pierde queda afuera. Requiere potencia de 2 de parejas (4, 8, 16…). Para muchos participantes. Opcionalmente podés activar la Copa de Plata 🥈, una llave paralela para los perdedores de primera ronda.</li>
              <li><span className="font-semibold">🎉 Peña:</span> Evento social. Los jugadores se inscriben individualmente, sin competencia ni ranking. Se sortea una única ronda de parejas al iniciar.</li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-[var(--text-primary)]">Paso a paso para crear un torneo</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[var(--text-secondary)]">
              <li>Hacé clic en <strong>Crear</strong> y completá los datos: nombre, tipo, fechas, precio y categoría de nivel.</li>
              <li>El torneo queda en estado <strong>Inscripción abierta</strong>. Los jugadores ven el torneo y pueden inscribirse pagando desde la app.</li>
              <li>Cuando llegue la fecha, entrá al torneo y hacé clic en <strong>Iniciar torneo</strong>. Se genera el fixture automáticamente.</li>
              <li>A medida que se juegan los partidos, ingresá los sets ganados de cada pareja y guardá. El ELO de los jugadores se actualiza solo.</li>
              <li>Al terminar todas las rondas, hacé clic en <strong>Finalizar torneo</strong>.</li>
            </ol>
          </div>

          <div>
            <p className="font-bold text-[var(--text-primary)]">Inscripción y pagos</p>
            <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
              Los jugadores pagan con Mercado Pago directamente desde la app. El 100% del precio que configuraste va a tu cuenta.
            </p>
          </div>

          <div>
            <p className="font-bold text-[var(--text-primary)]">Resultados y ELO</p>
            <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
              Cargás los sets de cada partido (ej. 3–1). El sistema calcula automáticamente el cambio de nivel ELO de cada jugador. En torneos el multiplicador es mayor que en partidos comunes, así que un torneo puede mover más el nivel.
            </p>
          </div>

          <div>
            <p className="font-bold text-[var(--text-primary)]">Cierre de inscripción</p>
            <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
              Las inscripciones se cierran automáticamente cuando se alcanza el máximo de parejas o cuando pasa la fecha límite que configuraste. Después de eso no se aceptan nuevos pagos.
            </p>
          </div>

          <div className={adminTip}>
            <span className="font-bold">Consejo:</span> Para eliminación directa, asegurate de tener exactamente 4, 8, 16 o 32 parejas pagadas antes de iniciar. Si tenés más inscriptos esperando, podés pedirles que completen el pago.
          </div>
        </div>
      </details>

      <section className="mt-8">
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
