import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import type { CourtTimeRangeInput } from "@/lib/court-slots";
import { createClient } from "@/utils/supabase/server";
import ClasesHubClient, {
  type PracticeRow,
  type ProfessorGroup,
  type PunctualTrainingItem,
} from "./clases-hub-client";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

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
  const coachOptions = (coachesRaw ?? []) as { id: string; name: string }[];

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

  const practices: PracticeRow[] = (
    (rows ?? []) as Array<{
      id: string;
      title: string;
      status: string;
      recurrence_type: string;
      start_date: string;
      end_date: string;
      max_spots: number;
      price_base: number;
    }>
  ).map((p) => ({ ...p, sessionCount: sessionsBy.get(p.id) ?? 0 }));

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

  const punctualItems: PunctualTrainingItem[] = punctualCourtBlocks.map((b) => ({
    key: `block-${b.id}`,
    title: "Entrenamiento externo",
    courtName: courtNameById.get(b.court_id) ?? "Cancha",
    scheduleLabel: `${format(parseISO(b.blocked_date), "d MMM yyyy", { locale: es })} · ${String(b.blocked_time).slice(0, 5)} hs`,
    courtBlockId: b.id,
  }));

  // Agrupar los turnos recurrentes por profesor (título del training_block)
  // para mostrar un solo encabezado con todos sus horarios debajo.
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
    <ClasesHubClient
      clubId={clubId}
      courtOptions={courtOptions}
      coachOptions={coachOptions}
      courtTimeRanges={courtTimeRanges}
      clubOpen={clubOpen}
      clubClose={clubClose}
      professorGroups={professorGroups}
      punctualItems={punctualItems}
      practices={practices}
    />
  );
}
