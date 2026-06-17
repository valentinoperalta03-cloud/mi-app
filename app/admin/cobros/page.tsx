import Link from "next/link";
import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { AR_TIME_ZONE, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, getAdminClient } from "@/utils/supabase/server";
import {
  confirmOfflineCobro,
  confirmPracticeOfflineCobro,
  markOfflineNoShow,
  markPracticeOfflineNoShow,
} from "./actions";

function isYmdInArgentina(iso: string, ymd: string): boolean {
  return (
    new Intl.DateTimeFormat("en-CA", {
      timeZone: AR_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso)) === ymd
  );
}

type PageProps = {
  searchParams?: Promise<{ error?: string; ok?: string }>;
};

export default async function AdminCobrosPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.length) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-28 pt-6 md:px-8">
        <AdminBackLink />
        <p className="text-sm text-slate-600 dark:text-slate-300">No hay canchas asignadas a tu club.</p>
      </div>
    );
  }

  const todayAr = getTodayYmdInArgentina();
  const clubId = ctx.clubIds[0]!;
  const admin = await getAdminClient();

  const { data: clubMatchRows } = await supabase
    .from(DB_TABLES.matches)
    .select("id")
    .in("court_id", ctx.courtIds);
  const clubMatchIds = (clubMatchRows ?? []).map((m: { id: string }) => m.id);

  const [
    { data: pendingRows, error: pendErr },
    { data: practicePendingRows, error: practicePendErr },
    { data: payRows },
    { data: practiceApprovedRows },
    { data: debtRows },
    { data: noShowRows },
  ] = await Promise.all([
    supabase
      .from(DB_TABLES.matches)
      .select("id, owner_id, court_id, scheduled_time, total_price, payment_status, match_type")
      .in("court_id", ctx.courtIds)
      .eq("scheduled_date", todayAr)
      .in("payment_status", ["cash_pending", "transfer_pending"])
      .order("scheduled_time", { ascending: true }),
    supabase
      .from(DB_TABLES.practiceRegistrations)
      .select(
        "id, player_id, payment_status, payment_method, amount, practice_sessions!inner(session_date, start_time, practices!inner(title, club_id))"
      )
      .in("payment_status", ["cash_pending", "transfer_pending"])
      .eq("practice_sessions.session_date", todayAr)
      .in("practice_sessions.practices.club_id", ctx.clubIds)
      .order("registered_at", { ascending: true }),
    clubMatchIds.length > 0
      ? admin
          .from(DB_TABLES.payments)
          .select(
            "id, amount, updated_at, payment_method, match_id, user_id, matches!inner(court_id, scheduled_date, scheduled_time)"
          )
          .eq("status", "approved")
          .in("payment_method", ["cash", "transfer"])
          .in("match_id", clubMatchIds)
          .order("updated_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    supabase
      .from(DB_TABLES.practiceRegistrations)
      .select(
        "id, player_id, payment_status, payment_method, amount, confirmed_at, practice_sessions!inner(session_date, start_time, practices!inner(title, club_id))"
      )
      .eq("payment_status", "approved")
      .in("payment_method", ["cash", "transfer"])
      .eq("practice_sessions.session_date", todayAr)
      .in("practice_sessions.practices.club_id", ctx.clubIds)
      .order("confirmed_at", { ascending: false }),
    supabase
      .from(DB_TABLES.clubDebts)
      .select("id, amount, confirmed_at, payment_method, match_id")
      .eq("club_id", clubId)
      .order("confirmed_at", { ascending: false })
      .limit(80),
    supabase
      .from(DB_TABLES.matches)
      .select("id, owner_id, court_id, scheduled_time, total_price")
      .in("court_id", ctx.courtIds)
      .eq("scheduled_date", todayAr)
      .eq("payment_status", "no_show")
      .order("scheduled_time", { ascending: true }),
  ]);

  const pending = (pendingRows ?? []) as Array<{
    id: string;
    owner_id: string;
    court_id: string;
    scheduled_time: string | null;
    total_price: number | null;
    payment_status: string | null;
    match_type: string | null;
  }>;

  type PracticePendingRow = {
    id: string;
    player_id: string;
    payment_status: string;
    amount: number | null;
    practice_sessions: {
      session_date: string;
      start_time: string;
      practices: { title: string; club_id: string } | { title: string; club_id: string }[];
    } | {
      session_date: string;
      start_time: string;
      practices: { title: string; club_id: string } | { title: string; club_id: string }[];
    }[];
  };

  function parsePracticeReg(row: PracticePendingRow & { payment_method?: string | null }) {
    const s = Array.isArray(row.practice_sessions) ? row.practice_sessions[0] : row.practice_sessions;
    const p = s ? (Array.isArray(s.practices) ? s.practices[0] : s.practices) : null;
    return {
      id: row.id,
      player_id: row.player_id,
      payment_status: row.payment_status,
      payment_method: String(row.payment_method ?? "").toLowerCase(),
      amount: row.amount,
      session_date: s?.session_date ?? "",
      start_time: s?.start_time ?? "",
      title: p?.title ?? "Clase",
      club_id: p?.club_id ?? "",
    };
  }

  const practicePending = ((practicePendingRows ?? []) as PracticePendingRow[]).map(parsePracticeReg);

  const practiceApprovedToday = ((practiceApprovedRows ?? []) as PracticePendingRow[]).map(parsePracticeReg);

  const noShows = (noShowRows ?? []) as Array<{
    id: string;
    owner_id: string;
    court_id: string;
    scheduled_time: string | null;
    total_price: number | null;
  }>;

  const courtName = new Map(ctx.courts.map((c) => [c.id, c.name ?? "Cancha"]));

  const paymentsAll = (payRows ?? []) as Array<{
    id: string;
    amount: number | null;
    updated_at: string | null;
    payment_method: string | null;
    user_id: string;
    match_id: string;
    matches:
      | {
          court_id: string;
          scheduled_date: string | null;
          scheduled_time: string | null;
        }
      | {
          court_id: string;
          scheduled_date: string | null;
          scheduled_time: string | null;
        }[]
      | null;
  }>;
  const paymentsToday = paymentsAll.filter((p) => {
    const rel = p.matches;
    const match = Array.isArray(rel) ? rel[0] ?? null : rel;
    if (!match) return false;
    const court = match.court_id;
    if (!court || !ctx.courtIds.includes(court)) return false;
    if (!p.updated_at) return false;
    return isYmdInArgentina(p.updated_at, todayAr);
  });
  const confirmadosHoy = paymentsToday.length + practiceApprovedToday.length;
  const totalCobradoHoy =
    paymentsToday.reduce((s, p) => s + Number(p.amount ?? 0), 0) +
    practiceApprovedToday.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalEfectivo =
    paymentsToday.filter((p) => p.payment_method === "cash").reduce((s, p) => s + Number(p.amount ?? 0), 0) +
    practiceApprovedToday.filter((p) => p.payment_method === "cash").reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalTransferencia =
    paymentsToday.filter((p) => p.payment_method === "transfer").reduce((s, p) => s + Number(p.amount ?? 0), 0) +
    practiceApprovedToday
      .filter((p) => p.payment_method === "transfer")
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const profileUserIds = [
    ...new Set([
      ...pending.map((p) => p.owner_id),
      ...practicePending.map((p) => p.player_id),
      ...practiceApprovedToday.map((p) => p.player_id),
      ...paymentsToday.map((p) => p.user_id),
      ...noShows.map((m) => m.owner_id),
    ].filter(Boolean)),
  ];
  const { data: profs } = profileUserIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id, name").in("user_id", profileUserIds)
    : { data: [] };
  const playerName = new Map(
    ((profs ?? []) as Array<{ user_id: string; name: string | null }>).map((p) => [
      p.user_id,
      p.name?.trim() || "Jugador",
    ])
  );

  const debts = (debtRows ?? []) as Array<{
    id: string;
    amount: number | null;
    confirmed_at: string;
    payment_method: string | null;
    match_id: string | null;
  }>;
  const debtsTodayCount = debts.filter((d) => isYmdInArgentina(d.confirmed_at, todayAr)).length;

  const err = sp.error ? decodeURIComponent(sp.error) : "";
  const ok = sp.ok === "1";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-28 pt-6 md:max-w-3xl md:px-8">
      <AdminBackLink />
      <header className="space-y-1">
        <p className={adminKicker}>Operaciones</p>
        <h1 className={adminTitle}>Cobros del día</h1>
        <p className={adminSubtitle}>Confirmá los pagos pendientes de efectivo y transferencia</p>
      </header>

      {ok ? (
        <p className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          Actualizado correctamente.
        </p>
      ) : null}
      {err ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
          {err}
        </p>
      ) : null}
      {pendErr ? (
        <p className="text-sm text-rose-600">No se pudieron cargar los pendientes: {pendErr.message}</p>
      ) : null}
      {practicePendErr ? (
        <p className="text-sm text-rose-600">No se pudieron cargar clases pendientes: {practicePendErr.message}</p>
      ) : null}

      <details className="group overflow-hidden rounded-3xl border border-sky-200 bg-sky-50 dark:border-sky-800/60 dark:bg-sky-900/60">
        <summary className="flex cursor-pointer select-none items-center gap-2.5 px-5 py-4 text-sm font-semibold text-sky-900 marker:content-none dark:text-sky-100">
          <Info size={18} className="shrink-0 text-sky-600 dark:text-sky-400" />
          ¿Cómo funciona la sección de cobros?
          <span className="ml-auto text-xs font-normal text-sky-600 dark:text-sky-400 group-open:hidden">Ver guía</span>
          <span className="ml-auto hidden text-xs font-normal text-sky-600 dark:text-sky-400 group-open:inline">Cerrar</span>
        </summary>
        <div className="space-y-5 border-t border-sky-200/60 px-5 pb-5 pt-4 text-sm text-slate-800 dark:border-sky-800/40 dark:text-slate-200">

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">¿Qué aparece acá?</p>
            <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
              Sólo los pagos que el jugador eligió hacer en persona: <strong>efectivo</strong> o <strong>transferencia bancaria</strong>. Los pagos con Mercado Pago se confirman automáticamente y no aparecen aquí.
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">Flujo de un pago offline</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-slate-700 dark:text-slate-300">
              <li>El jugador reserva una cancha o se anota a una clase y elige pagar en persona.</li>
              <li>El sistema registra el cobro como <strong>pendiente</strong> y aparece en esta pantalla.</li>
              <li>Cuando el jugador te entrega el dinero o te hace la transferencia, hacé clic en <strong>Confirmar cobro</strong>. El pago queda registrado y el lugar confirmado.</li>
              <li>Si el jugador no se presentó, marcalo con <strong>No se presentó</strong> para liberar el turno.</li>
            </ol>
          </div>

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">Resumen del día</p>
            <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
              Las tarjetas del encabezado muestran cuántos cobros están pendientes, cuántos se confirmaron hoy y el total cobrado separado por efectivo y transferencia. Estos números se resetean con cada día nuevo.
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">Deudas PadeLibre</p>
            <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
              Cuando un jugador no paga con Mercado Pago y el club confirma el cobro igualmente, se registra internamente como una <strong>deuda con PadeLibre</strong> por la comisión de servicio correspondiente. Estas deudas se liquidan periódicamente según el acuerdo con PadeLibre.
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">Historial reciente</p>
            <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
              La sección <strong>Confirmados hoy</strong> muestra todos los cobros offline que ya procesaste en el día. Los últimos 20 cobros aprobados de reservas también son visibles en la lista de historial.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/50 dark:text-amber-100">
            <span className="font-bold">Consejo:</span> Si activás los métodos de pago en <strong>Configuración → Métodos de pago</strong>, podés habilitar o deshabilitar efectivo y transferencia para controlar qué opciones ven los jugadores al reservar.
          </div>
        </div>
      </details>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={adminCard}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pendientes</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
            {pending.length + practicePending.length}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">de cobro hoy</p>
        </div>
        <div className={adminCard}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Confirmados</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{confirmadosHoy}</p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">efectivo y transferencia</p>
        </div>
        <div className={adminCard}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total cobrado</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            ${totalCobradoHoy.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-2 space-y-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span className="block">💵 Efectivo: ${totalEfectivo.toLocaleString("es-AR")}</span>
            <span className="block">🏦 Transferencia: ${totalTransferencia.toLocaleString("es-AR")}</span>
          </p>
          {debtsTodayCount > 0 ? (
            <p className="mt-2 text-[10px] font-medium text-slate-400">{debtsTodayCount} deuda(s) PadeLibre registradas</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pendientes ({todayAr})</h2>
        {pending.length === 0 && practicePending.length === 0 ? (
          <p className={`${adminCard} text-sm text-slate-500 dark:text-slate-400`}>No hay cobros pendientes para hoy.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {practicePending.map((pr) => {
              const pay = String(pr.payment_status ?? "").toLowerCase();
              const methodLabel = pay === "cash_pending" ? "Efectivo" : "Transferencia";
              const name = playerName.get(pr.player_id) ?? "Jugador";
              const time = String(pr.start_time ?? "").slice(0, 5);
              const amount = Math.round(Number(pr.amount ?? 0));
              return (
                <li
                  key={pr.id}
                  className={`${adminCard} flex flex-col gap-3 border-amber-200/80 dark:border-amber-900/50`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">{name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Clase · {pr.title} · {time}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      ${amount.toLocaleString("es-AR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Método:</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {methodLabel}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <form action={confirmPracticeOfflineCobro} className="flex-1">
                      <input type="hidden" name="registration_id" value={pr.id} />
                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] dark:bg-emerald-500 dark:hover:bg-emerald-600"
                      >
                        Confirmar cobro
                      </button>
                    </form>
                    <form action={markPracticeOfflineNoShow} className="flex-1">
                      <input type="hidden" name="registration_id" value={pr.id} />
                      <button
                        type="submit"
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        No se presentó
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
            {pending.map((m) => {
              const pay = String(m.payment_status ?? "").toLowerCase();
              const methodLabel =
                pay === "cash_pending" ? "Efectivo" : pay === "transfer_pending" ? "Transferencia" : "MP";
              const name = playerName.get(m.owner_id) ?? "Jugador";
              const time = String(m.scheduled_time ?? "").slice(0, 5);
              const court = courtName.get(m.court_id) ?? "Cancha";
              const amount = Math.round(Number(m.total_price ?? 0) / 4 * 1.05);
              return (
                <li
                  key={m.id}
                  className={`${adminCard} flex flex-col gap-3 border-slate-200/90 dark:border-slate-700`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-slate-900 dark:text-slate-100">{name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {court} · {time} ·{" "}
                        {String(m.match_type ?? "").toLowerCase() === "reservation" ? "Reserva" : "Partido"}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      ${amount.toLocaleString("es-AR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Método:</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {methodLabel}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <form action={confirmOfflineCobro} className="flex-1">
                      <input type="hidden" name="match_id" value={m.id} />
                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] dark:bg-emerald-500 dark:hover:bg-emerald-600"
                      >
                        Confirmar cobro
                      </button>
                    </form>
                    <form action={markOfflineNoShow} className="flex-1">
                      <input type="hidden" name="match_id" value={m.id} />
                      <button
                        type="submit"
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        No se presentó
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {paymentsToday.length > 0 || practiceApprovedToday.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Confirmados hoy ({todayAr})</h2>
          <ul className="flex flex-col gap-2">
            {practiceApprovedToday.map((pr) => {
              const methodLabel =
                pr.payment_method === "cash"
                  ? "Efectivo"
                  : pr.payment_method === "transfer"
                    ? "Transferencia"
                    : "—";
              const name = playerName.get(pr.player_id) ?? "Jugador";
              const time = String(pr.start_time ?? "").slice(0, 5);
              const amount = Number(pr.amount ?? 0);
              return (
                <li
                  key={pr.id}
                  className={`${adminCard} flex flex-wrap items-center justify-between gap-2 border-emerald-200/60 dark:border-emerald-900/40`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Clase · {pr.title} · {time || "—"}
                    </p>
                    <span className="mt-1.5 inline-block rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {methodLabel}
                    </span>
                  </div>
                  <p className="shrink-0 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    ${amount.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </p>
                </li>
              );
            })}
            {paymentsToday.map((p) => {
              const rel = p.matches;
              const match = Array.isArray(rel) ? rel[0] ?? null : rel;
              const time = String(match?.scheduled_time ?? "").slice(0, 5);
              const court = courtName.get(match?.court_id ?? "") ?? "Cancha";
              const name = playerName.get(p.user_id) ?? "Jugador";
              const methodLabel =
                p.payment_method === "cash"
                  ? "Efectivo"
                  : p.payment_method === "transfer"
                    ? "Transferencia"
                    : "—";
              const amount = Number(p.amount ?? 0);
              return (
                <li
                  key={p.id}
                  className={`${adminCard} flex flex-wrap items-center justify-between gap-2 border-emerald-200/60 dark:border-emerald-900/40`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {court} · {time || "—"}
                    </p>
                    <span className="mt-1.5 inline-block rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {methodLabel}
                    </span>
                  </div>
                  <p className="shrink-0 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    ${amount.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {noShows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">No se presentaron hoy ({todayAr})</h2>
          <ul className="flex flex-col gap-2">
            {noShows.map((m) => {
              const name = playerName.get(m.owner_id) ?? "Jugador";
              const time = String(m.scheduled_time ?? "").slice(0, 5);
              const court = courtName.get(m.court_id) ?? "Cancha";
              return (
                <li
                  key={m.id}
                  className={`${adminCard} flex flex-wrap items-center justify-between gap-2 border-rose-200/60 dark:border-rose-900/40`}
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {court} · {time || "—"}
                    </p>
                  </div>
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
                    No show
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        ¿Problemas con un cobro?{" "}
        <Link href="/admin/config" className="font-semibold text-[#0585FC] hover:underline">
          Configuración
        </Link>
      </p>
    </div>
  );
}
