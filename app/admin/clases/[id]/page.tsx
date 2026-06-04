import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft } from "lucide-react";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import {
  PRACTICE_MODALITY_OPTIONS,
  PRACTICE_RECURRENCE_OPTIONS,
  PRACTICE_STATUS_LABELS,
  PRACTICE_SESSION_STATUS_LABELS,
} from "@/lib/practice-constants";
import { practiceTotalPrice } from "@/lib/practice-pricing";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import { PublishPracticeButton, CancelPracticeButton } from "../publish-practice-button";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function AdminClaseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: p } = await supabase
    .from(DB_TABLES.practices)
    .select(
      "id, club_id, title, description, modality, status, recurrence_type, start_date, end_date, start_time, max_spots, price_base, weekly_days, coach_id, court_id, practice_coaches(name), courts(name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) redirect("/admin/clases");

  const raw = p as Record<string, unknown>;
  const practice = raw as {
    club_id: string;
    title: string;
    description: string | null;
    modality: string;
    status: string;
    recurrence_type: string;
    start_date: string;
    end_date: string;
    start_time: string;
    max_spots: number;
    price_base: number;
    weekly_days: number[] | null;
  };
  if (!ctx.clubIds.includes(practice.club_id)) redirect("/admin/clases");

  const coachPack = raw.practice_coaches;
  const coachRow = Array.isArray(coachPack) ? coachPack[0] : coachPack;
  const coachName = (coachRow as { name?: string } | null)?.name;
  const courtPack = raw.courts;
  const courtRow = Array.isArray(courtPack) ? courtPack[0] : courtPack;
  const courtName = (courtRow as { name?: string } | null)?.name;

  const service = createServiceClient();
  const { data: sessions } = await service
    .from(DB_TABLES.practiceSessions)
    .select("id, session_date, start_time, status")
    .eq("practice_id", id)
    .order("session_date", { ascending: true });

  const sessionList = (sessions ?? []) as Array<{
    id: string;
    session_date: string;
    start_time: string;
    status: string;
  }>;
  const sessionIds = sessionList.map((s) => s.id);

  const { data: regs } = sessionIds.length
    ? await service
        .from(DB_TABLES.practiceRegistrations)
        .select("id, session_id, player_id, payment_status, registered_at")
        .in("session_id", sessionIds)
        .order("registered_at", { ascending: true })
    : { data: [] };

  const regList = (regs ?? []) as Array<{
    id: string;
    session_id: string;
    player_id: string;
    payment_status: string;
    registered_at: string;
  }>;
  const playerIds = [...new Set(regList.map((r) => r.player_id))];
  const { data: profiles } = playerIds.length
    ? await service.from(DB_TABLES.profiles).select("user_id, name").in("user_id", playerIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Array<{ user_id: string; name: string | null }>).map((x) => [x.user_id, x.name ?? "Jugador"])
  );

  const regsBySession = new Map<string, typeof regList>();
  for (const r of regList) {
    const arr = regsBySession.get(r.session_id) ?? [];
    arr.push(r);
    regsBySession.set(r.session_id, arr);
  }

  const modalityLabel = PRACTICE_MODALITY_OPTIONS.find((o) => o.value === practice.modality)?.label ?? practice.modality;
  const recurrenceLabel =
    PRACTICE_RECURRENCE_OPTIONS.find((o) => o.value === practice.recurrence_type)?.label ?? practice.recurrence_type;
  const finalPrice = practiceTotalPrice(Number(practice.price_base));

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pb-28 pt-6 md:pb-10">
      <Link href="/admin/clases" className="inline-flex items-center gap-1 text-sm font-medium text-[#0461C4] dark:text-sky-400">
        <ChevronLeft size={18} />
        Clases
      </Link>

      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {PRACTICE_STATUS_LABELS[practice.status] ?? practice.status}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{practice.title}</h1>
        {practice.description ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{practice.description}</p>
        ) : null}
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {recurrenceLabel} · {modalityLabel} · {practice.max_spots} cupos
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Precio club ${Number(practice.price_base).toLocaleString("es-AR")} · Jugador paga ${finalPrice.toLocaleString("es-AR")}{" "}
          (5% comisión)
        </p>
        {coachName ? <p className="mt-1 text-xs text-slate-500">Profesor: {coachName}</p> : null}
        {courtName ? <p className="mt-1 text-xs text-slate-500">Cancha: {courtName}</p> : null}

        {practice.status === "draft" ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <PublishPracticeButton practiceId={id} />
          </div>
        ) : null}
        {practice.status === "open" ? (
          <div className="mt-4">
            <CancelPracticeButton practiceId={id} />
          </div>
        ) : null}
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Fechas e inscriptos
        </h2>
        {sessionList.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
            {practice.status === "draft"
              ? "Publicá la clase para generar las fechas."
              : "Sin fechas generadas."}
          </p>
        ) : (
          <ul className="space-y-3">
            {sessionList.map((s) => {
              const dt = parseISO(`${s.session_date}T${String(s.start_time).slice(0, 5)}:00`);
              const sessionRegs = regsBySession.get(s.id) ?? [];
              const approved = sessionRegs.filter((r) => r.payment_status === "approved").length;
              return (
                <li
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold capitalize text-slate-900 dark:text-white">
                      {format(dt, "EEEE d MMM yyyy · HH:mm", { locale: es })}
                    </p>
                    <span className="text-xs text-slate-500">
                      {PRACTICE_SESSION_STATUS_LABELS[s.status] ?? s.status} · {approved}/{practice.max_spots} pagos
                    </span>
                  </div>
                  {sessionRegs.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Sin inscriptos.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {sessionRegs.map((r) => (
                        <li key={r.id} className="flex justify-between gap-2 text-slate-700 dark:text-slate-300">
                          <span>{profileMap.get(r.player_id)}</span>
                          <span className="text-xs text-slate-500">
                            {r.payment_status === "approved"
                              ? "Pagado"
                              : r.payment_status === "pending"
                                ? "Pendiente"
                                : r.payment_status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
