import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Dumbbell, GraduationCap } from "lucide-react";
import AdminGuideBox from "@/components/admin/admin-guide-box";
import AdminPageHeader from "@/components/admin/admin-page-header";
import {
  adminAccentBar,
  adminBadgeNeutral,
  adminCard,
  adminCTADangerCompact,
  adminEmptyState,
  adminSectionLabel,
  adminTip,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import type { CourtTimeRangeInput } from "@/lib/court-slots";
import { PRACTICE_STATUS_LABELS } from "@/lib/practice-constants";
import { createClient } from "@/utils/supabase/server";
import { deactivateTrainingBlockAction, deleteExternalTrainingBlockRowAction } from "./actions";
import ClasePublicaModal from "./clase-publica-modal";
import TrainingWizard from "./training-wizard-client";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type ExternalTrainingItem = {
  key: string;
  title: string;
  courtName: string;
  scheduleLabel: string;
  coach: string | null;
  modality: string | null;
  formAction: (formData: FormData) => Promise<void>;
  hiddenFieldName: string;
  hiddenFieldValue: string;
};

export default async function AdminClasesPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");
  const clubId = ctx.clubIds[0]!;

  const { data: clubHoursRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("open_time,close_time")
    .eq("id", clubId)
    .maybeSingle();
  const clubOpen = String((clubHoursRow as { open_time?: string | null } | null)?.open_time ?? "").trim().slice(0, 5);
  const clubClose = String((clubHoursRow as { close_time?: string | null } | null)?.close_time ?? "").trim().slice(0, 5);

  const { data: courtTimeRangesRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.courtTimeRanges)
        .select("court_id,day_of_week,open_time,close_time")
        .in("court_id", ctx.courtIds)
    : { data: [] };
  const courtTimeRanges = (courtTimeRangesRaw ?? []) as CourtTimeRangeInput[];

  const { data: coachesRaw } = await supabase
    .from(DB_TABLES.practiceCoaches)
    .select("id, name")
    .eq("club_id", clubId)
    .order("name");
  const coachOptions = ((coachesRaw ?? []) as { id: string; name: string }[]);

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

  const courtOptions = ctx.courts.map((c) => ({ id: c.id, name: c.name ?? "Cancha" }));
  const courtNameById = new Map(courtOptions.map((c) => [c.id, c.name]));

  const { data: trainingBlocksRaw } = await supabase
    .from(DB_TABLES.trainingBlocks)
    .select("id,court_id,title,coach,modality,day_of_week,start_time,end_time")
    .in("club_id", ctx.clubIds)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  const trainingBlocks = (trainingBlocksRaw ?? []) as Array<{
    id: string;
    court_id: string;
    title: string;
    coach: string | null;
    modality: string | null;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;

  const today = getTodayYmdInArgentina();
  const { data: externalCourtBlocksRaw } = ctx.courtIds.length
    ? await supabase
        .from(DB_TABLES.courtBlocks)
        .select("id,court_id,blocked_date,blocked_time")
        .in("court_id", ctx.courtIds)
        .eq("reason", "entrenamiento_externo")
        .gte("blocked_date", today)
        .order("blocked_date", { ascending: true })
    : { data: [] };
  const externalCourtBlocks = (externalCourtBlocksRaw ?? []) as Array<{
    id: string;
    court_id: string;
    blocked_date: string;
    blocked_time: string;
  }>;

  // Los court_blocks generados por un training_block recurrente comparten
  // reason='entrenamiento_externo' con los puntuales (así los detecta el
  // dashboard y loadAvailability por igual) — para no listarlos uno por
  // ocurrencia acá, se excluyen los que matchean cancha+horario+día de semana
  // de algún training_block activo, y ese training_block se muestra una sola vez.
  const activeTrainingKeys = new Set(
    trainingBlocks.map((t) => `${t.court_id}__${t.day_of_week}__${String(t.start_time).slice(0, 5)}`)
  );
  const punctualCourtBlocks = externalCourtBlocks.filter((b) => {
    const dow = new Date(`${b.blocked_date}T12:00:00`).getDay();
    const key = `${b.court_id}__${dow}__${String(b.blocked_time).slice(0, 5)}`;
    return !activeTrainingKeys.has(key);
  });

  const punctualItems: ExternalTrainingItem[] = punctualCourtBlocks.map((b) => ({
    key: `block-${b.id}`,
    title: "Entrenamiento externo",
    courtName: courtNameById.get(b.court_id) ?? "Cancha",
    scheduleLabel: `${format(parseISO(b.blocked_date), "d MMM yyyy", { locale: es })} · ${String(b.blocked_time).slice(0, 5)} hs`,
    coach: null,
    modality: null,
    formAction: deleteExternalTrainingBlockRowAction,
    hiddenFieldName: "court_block_id",
    hiddenFieldValue: b.id,
  }));

  // Agrupar los turnos recurrentes por profesor (título del training_block)
  // para mostrar un solo encabezado con todos sus horarios debajo.
  type ProfessorSchedule = { trainingBlockId: string; scheduleLabel: string; courtName: string; modality: string | null };
  type ProfessorGroup = { key: string; professorName: string; schedules: ProfessorSchedule[] };
  const professorGroupMap = new Map<string, ProfessorGroup>();
  for (const t of trainingBlocks) {
    const professorName = (t.coach && t.coach.trim()) || t.title;
    const group = professorGroupMap.get(professorName) ?? { key: professorName, professorName, schedules: [] };
    group.schedules.push({
      trainingBlockId: t.id,
      scheduleLabel: `${DAY_LABELS[t.day_of_week]} · ${String(t.start_time).slice(0, 5)} - ${String(t.end_time).slice(0, 5)}`,
      courtName: courtNameById.get(t.court_id) ?? "Cancha",
      modality: t.modality,
    });
    professorGroupMap.set(professorName, group);
  }
  const professorGroups = Array.from(professorGroupMap.values());

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        kicker="Gestión de juego"
        title="Clases y entrenamientos"
        subtitle="Clases públicas y entrenamientos externos de tu club"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${adminCard} border-l-4 border-l-[#0085FC]`}>
          <div className="mb-2 flex items-center gap-2">
            <Dumbbell size={18} className="text-[#0085FC]" />
            <p className="font-bold text-[var(--text-primary)]">Entrenamientos externos</p>
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Son los horarios donde un profesor particular usa tu cancha para dar clases privadas.
            Bloquean la cancha automáticamente para que no aparezca disponible para reservas.
            Los jugadores NO los ven en la app.
          </p>
        </div>
        <div className={`${adminCard} border-l-4 border-l-[#CCFF00]`}>
          <div className="mb-2 flex items-center gap-2">
            <GraduationCap size={18} className="text-[#CCFF00]" />
            <p className="font-bold text-[var(--text-primary)]">Clases públicas</p>
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Son clases que publicás para que los jugadores se inscriban desde la app.
            Tienen precio, cupos y horarios visibles. Los jugadores pueden reservar su lugar
            y pagar online o en el club.
          </p>
        </div>
      </div>

      <AdminGuideBox title="¿Cuál es la diferencia entre entrenamientos y clases?">
        <ol className="list-decimal space-y-1.5 pl-4 text-[var(--text-secondary)]">
          <li>
            <strong>Entrenamientos externos:</strong> un profesor particular usa tu cancha. Bloquea el horario
            automáticamente. Los jugadores NO los ven.
          </li>
          <li>
            <strong>Clases públicas:</strong> las publicás para que los jugadores se inscriban y paguen desde la
            app.
          </li>
          <li>Para los entrenamientos, usá el wizard de profesores para asignar horarios fácilmente.</li>
          <li>Para las clases, creá la clase con precio, cupos y horario, y publicala cuando esté lista.</li>
        </ol>
      </AdminGuideBox>

      <section>
        <div className="flex items-start justify-between gap-3">
          <h2 className={adminSectionLabel}>Entrenamientos externos</h2>
          <TrainingWizard courts={courtOptions} timeRanges={courtTimeRanges} clubOpen={clubOpen} clubClose={clubClose} />
        </div>

        <ul className="mt-3 space-y-2">
          {professorGroups.length === 0 && punctualItems.length === 0 ? (
            <li className={adminEmptyState}>Todavía no registraste entrenamientos externos.</li>
          ) : null}
          {professorGroups.map((group) => (
            <li key={group.key} className={adminCard}>
              <p className="font-semibold text-[var(--text-primary)]">{group.professorName}</p>
              <ul className="mt-2 space-y-1.5">
                {group.schedules.map((s) => (
                  <li
                    key={s.trainingBlockId}
                    className="flex items-center justify-between gap-3 text-xs text-[var(--text-tertiary)]"
                  >
                    <span>
                      {s.scheduleLabel} · {s.courtName}
                      {s.modality ? ` · ${s.modality}` : ""}
                    </span>
                    <form action={deactivateTrainingBlockAction}>
                      <input type="hidden" name="training_block_id" value={s.trainingBlockId} />
                      <button type="submit" className={adminCTADangerCompact}>
                        Desactivar
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {punctualItems.map((item) => (
            <li key={item.key} className={`${adminCard} flex items-start justify-between gap-3`}>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {item.courtName} · {item.scheduleLabel}
                  {item.modality ? ` · ${item.modality}` : ""}
                </p>
              </div>
              <form action={item.formAction}>
                <input type="hidden" name={item.hiddenFieldName} value={item.hiddenFieldValue} />
                <button type="submit" className={adminCTADangerCompact}>
                  Dar de baja
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <AdminGuideBox title="¿Cómo funciona la sección de clases?">
          <div>
            <p className="font-bold text-[var(--text-primary)]">¿Qué es una clase en PadeLibre?</p>
            <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
              Las clases son sesiones de entrenamiento o práctica que tu club ofrece a los jugadores. Pueden ser únicas (un solo día) o recurrentes (todas las semanas en el mismo día y hora). Los jugadores las ven en la app, se inscriben y pagan directamente.
            </p>
          </div>

          <div>
            <p className="font-bold text-[var(--text-primary)]">Tipos de recurrencia</p>
            <ul className="mt-1.5 space-y-1.5 text-[var(--text-secondary)]">
              <li><span className="font-semibold">Clase única:</span> Se dicta una sola vez en la fecha que indiques. Ideal para clínicas o eventos especiales.</li>
              <li><span className="font-semibold">Semanal:</span> Se repite cada semana entre la fecha de inicio y la de fin. PadeLibre genera automáticamente una sesión por cada semana.</li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-[var(--text-primary)]">Paso a paso para crear una clase</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[var(--text-secondary)]">
              <li>Hacé clic en <strong>Crear</strong> y completá los datos: título, tipo, fechas, hora, precio, cupos y cancha.</li>
              <li>Asigná un coach desde el detalle de la clase (opcional).</li>
              <li>Publicá la clase con el botón <strong>Publicar</strong>. A partir de ahí los jugadores la pueden ver y anotarse.</li>
              <li>Cuando un jugador se inscribe, el cupo se descuenta en tiempo real. El pago puede ser Mercado Pago, efectivo o transferencia.</li>
            </ol>
          </div>

          <div>
            <p className="font-bold text-[var(--text-primary)]">Estados de una clase</p>
            <ul className="mt-1.5 space-y-1.5 text-[var(--text-secondary)]">
              <li><span className="font-semibold">Borrador:</span> Sólo la ves vos. Podés editarla antes de publicar.</li>
              <li><span className="font-semibold">Publicada:</span> Visible para todos los jugadores en la app.</li>
              <li><span className="font-semibold">Finalizada:</span> Terminó el período de clases. Ya no acepta nuevas inscripciones.</li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-[var(--text-primary)]">Precios</p>
            <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
              Configurás el precio base por sesión. El jugador paga exactamente el precio que vos definís. El 100% va a tu cuenta.
            </p>
          </div>

          <div>
            <p className="font-bold text-[var(--text-primary)]">Cobros offline (efectivo / transferencia)</p>
            <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
              Si un jugador elige pagar en persona, aparece en la sección <strong>Cobros</strong> del panel admin. Confirmás el pago ahí cuando recibís el dinero.
            </p>
          </div>

          <div className={adminTip}>
            <span className="font-bold">Consejo:</span> Publicá la clase con suficiente anticipación para que los jugadores puedan inscribirse. Para clases semanales, publicá al inicio de la semana o con una semana de adelanto.
          </div>
      </AdminGuideBox>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={adminSectionLabel}>Registro de clases</h2>
          <ClasePublicaModal clubId={clubId} courts={courtOptions} coaches={coachOptions} />
        </div>
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
            <li className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
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
                  className={`block ${adminCard} hover:-translate-y-0.5 ${p.status === "open" ? adminAccentBar : ""}`}
                >
                  <p className="font-semibold text-[var(--text-primary)]">{p.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
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
