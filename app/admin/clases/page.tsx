import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { GraduationCap, Info, Plus } from "lucide-react";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { PRACTICE_STATUS_LABELS } from "@/lib/practice-constants";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminClasesPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");

  const { data: rows } = await supabase
    .from(DB_TABLES.practices)
    .select("id, title, status, recurrence_type, start_date, end_date, max_spots, price_base")
    .in("club_id", ctx.clubIds)
    .order("created_at", { ascending: false });

  const practiceIds = ((rows ?? []) as { id: string }[]).map((r) => r.id);
  const { data: sessionCounts } = practiceIds.length
    ? await supabase.from(DB_TABLES.practiceSessions).select("practice_id").in("practice_id", practiceIds)
    : { data: [] };
  const sessionsBy = new Map<string, number>();
  for (const s of (sessionCounts ?? []) as { practice_id: string }[]) {
    sessionsBy.set(s.practice_id, (sessionsBy.get(s.practice_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 md:pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Clases</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Prácticas y entrenamientos de tu club.</p>
        </div>
        <Link
          href="/admin/clases/nuevo"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#0461C4] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <Plus size={18} />
          Crear
        </Link>
      </div>

      <details className="group mt-6 overflow-hidden rounded-3xl border border-sky-200 bg-sky-100/60 dark:border-sky-800/60 dark:bg-sky-900/60">
        <summary className="flex cursor-pointer select-none items-center gap-2.5 px-5 py-4 text-sm font-semibold text-sky-900 marker:content-none dark:text-sky-100">
          <Info size={18} className="shrink-0 text-sky-600 dark:text-sky-400" />
          ¿Cómo funciona la sección de clases?
          <span className="ml-auto text-xs font-normal text-sky-600 dark:text-sky-400 group-open:hidden">Ver guía</span>
          <span className="ml-auto hidden text-xs font-normal text-sky-600 dark:text-sky-400 group-open:inline">Cerrar</span>
        </summary>
        <div className="space-y-5 border-t border-sky-200/60 px-5 pb-5 pt-4 text-sm text-slate-800 dark:border-sky-800/40 dark:text-slate-200">

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">¿Qué es una clase en PadeLibre?</p>
            <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
              Las clases son sesiones de entrenamiento o práctica que tu club ofrece a los jugadores. Pueden ser únicas (un solo día) o recurrentes (todas las semanas en el mismo día y hora). Los jugadores las ven en la app, se inscriben y pagan directamente.
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">Tipos de recurrencia</p>
            <ul className="mt-1.5 space-y-1.5 text-slate-700 dark:text-slate-300">
              <li><span className="font-semibold">Clase única:</span> Se dicta una sola vez en la fecha que indiques. Ideal para clínicas o eventos especiales.</li>
              <li><span className="font-semibold">Semanal:</span> Se repite cada semana entre la fecha de inicio y la de fin. PadeLibre genera automáticamente una sesión por cada semana.</li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">Paso a paso para crear una clase</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-slate-700 dark:text-slate-300">
              <li>Hacé clic en <strong>Crear</strong> y completá los datos: título, tipo, fechas, hora, precio, cupos y cancha.</li>
              <li>Asigná un coach desde el detalle de la clase (opcional).</li>
              <li>Publicá la clase con el botón <strong>Publicar</strong>. A partir de ahí los jugadores la pueden ver y anotarse.</li>
              <li>Cuando un jugador se inscribe, el cupo se descuenta en tiempo real. El pago puede ser Mercado Pago, efectivo o transferencia.</li>
            </ol>
          </div>

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">Estados de una clase</p>
            <ul className="mt-1.5 space-y-1.5 text-slate-700 dark:text-slate-300">
              <li><span className="font-semibold">Borrador:</span> Sólo la ves vos. Podés editarla antes de publicar.</li>
              <li><span className="font-semibold">Publicada:</span> Visible para todos los jugadores en la app.</li>
              <li><span className="font-semibold">Finalizada:</span> Terminó el período de clases. Ya no acepta nuevas inscripciones.</li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">Precios y comisión</p>
            <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
              Configurás el precio base por sesión. PadeLibre agrega un 5% como comisión de servicio, que se suma al precio que ve el jugador. Vos recibís el precio base directamente. Por ejemplo, si ponés $2.000, el jugador paga $2.100.
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">Cobros offline (efectivo / transferencia)</p>
            <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
              Si un jugador elige pagar en persona, aparece en la sección <strong>Cobros</strong> del panel admin. Confirmás el pago ahí cuando recibís el dinero.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200/80 bg-amber-100/60 px-4 py-3 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/50 dark:text-amber-100">
            <span className="font-bold">Consejo:</span> Publicá la clase con suficiente anticipación para que los jugadores puedan inscribirse. Para clases semanales, publicá al inicio de la semana o con una semana de adelanto.
          </div>
        </div>
      </details>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Registro de clases
        </h2>
        <ul className="space-y-2">
          {((rows ?? []) as Array<{
            id: string;
            title: string;
            status: string;
            recurrence_type: string;
            start_date: string;
            end_date: string;
            max_spots: number;
            price_base: number;
          }>).length === 0 ? (
            <li className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Todavía no hay clases.
            </li>
          ) : null}
          {((rows ?? []) as Array<{
            id: string;
            title: string;
            status: string;
            recurrence_type: string;
            start_date: string;
            end_date: string;
            max_spots: number;
            price_base: number;
          }>).map((p) => {
            const dateLabel =
              p.recurrence_type === "weekly"
                ? `${format(parseISO(p.start_date), "d MMM", { locale: es })} – ${format(parseISO(p.end_date), "d MMM yyyy", { locale: es })}`
                : format(parseISO(p.start_date), "d MMM yyyy", { locale: es });
            const nSessions = sessionsBy.get(p.id) ?? 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/clases/${p.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-[#0461C4]/40 dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="font-semibold text-slate-900 dark:text-white">{p.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {PRACTICE_STATUS_LABELS[p.status] ?? p.status} · {dateLabel}
                    {nSessions > 0 ? ` · ${nSessions} fecha(s)` : ""} · {p.max_spots} cupos · $
                    {Number(p.price_base).toLocaleString("es-AR")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
