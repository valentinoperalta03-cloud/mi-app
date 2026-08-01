import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MatchesRealtimeRefresh } from "@/components/matches-realtime-refresh";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { PLAYER_CARD, PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";
import { simulatePaymentApproved } from "../actions";

type PageProps = {
  searchParams: Promise<{
    id?: string;
    court?: string;
    club?: string;
    payment_id?: string;
    status?: string;
    collection_status?: string;
    external_reference?: string;
    error?: string;
  }>;
};

function normalizePayState(
  collectionStatus: string | undefined,
  status: string | undefined,
  dbPaid: boolean
): "approved" | "pending" | "failure" | "offline" {
  const c = (collectionStatus ?? "").toLowerCase();
  const s = (status ?? "").toLowerCase();

  // Only approved when the database confirms paid via webhook.
  if (dbPaid) return "approved";

  // Explicit failure
  if (
    c === "failure" ||
    c === "rejected" ||
    s === "failure" ||
    s === "rejected" ||
    s === "cancelled" ||
    c === "cancelled"
  )
    return "failure";

  // Everything else is pending
  return "pending";
}

export default async function ConfirmacionReservaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawId = (params.id ?? params.external_reference)?.trim();
  const id = rawId?.includes("__") ? rawId.split("__")[0] : rawId;
  if (!id) {
    redirect("/reservas");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: row, error } = await supabase.from(DB_TABLES.matches).select("*").eq("id", id).maybeSingle();

  if (error || !row) {
    notFound();
  }

  const match = row as {
    owner_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    duration_minutes: number | null;
    match_type: string | null;
    payment_status: string | null;
    financial_status: string | null;
    amount_paid: number | null;
    amount_pending: number | null;
  };

  if (match.owner_id !== user.id) {
    notFound();
  }

  const isReservation = match.match_type === "reservation";
  const paymentIdParam = params.payment_id?.trim();

  if (paymentIdParam) {
    await supabase
      .from(DB_TABLES.payments)
      .update({
        mp_payment_id: paymentIdParam,
        updated_at: new Date().toISOString(),
      })
      .eq("match_id", id)
      .eq("user_id", user.id);
  }

  const payNorm = String(match.payment_status ?? "").toLowerCase();
  const payDb = payNorm === "paid";
  const offlinePending = payNorm === "cash_pending" || payNorm === "transfer_pending";
  const payState = offlinePending
    ? "offline"
    : normalizePayState(params.collection_status, params.status, payDb);
  /** Si no volvimos desde Mercado Pago, se confirmó directo (sin seña configurada): nunca hubo pago online. */
  const cameFromMp = Boolean(paymentIdParam || params.status || params.collection_status);
  const financialStatus = String(match.financial_status ?? "unpaid").toLowerCase();
  const amountPaid = Number(match.amount_paid ?? 0);
  const amountPending = Number(match.amount_pending ?? 0);

  const courtLabel = params.court ?? "Cancha";
  const clubLabel = params.club ?? "Club";
  const dateStr = match.scheduled_date ?? "";
  const timeStr = (match.scheduled_time ?? "").toString().trim().slice(0, 5);
  const duration = match.duration_minutes ?? 90;

  const fechaFormateada =
    dateStr.length >= 10
      ? format(parseISO(`${dateStr}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es })
      : "—";

  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase();
  const showDevSim =
    process.env.NODE_ENV === "development" &&
    (host.startsWith("localhost") || host.startsWith("127.0.0.1"));

  let headerBlock: ReactNode;
  if (payState === "approved" && !cameFromMp) {
    headerBlock = (
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700 shadow-inner dark:bg-emerald-950/50 dark:text-emerald-300">
          ✓
        </div>
        <h1 className="text-center text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
          Tu reserva en {clubLabel} quedó confirmada
        </h1>
        <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-300">
          El pago lo coordinás directamente con el club.
        </p>
      </div>
    );
  } else if (payState === "approved") {
    const isPartial = financialStatus === "partially_paid";
    headerBlock = (
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700 shadow-inner">
          ✓
        </div>
        <h1 className="text-center text-xl font-semibold tracking-tight text-slate-950">
          {isReservation ? "¡Reserva confirmada!" : "¡Pago registrado!"}
        </h1>
        <p className="text-center text-sm font-medium text-slate-600">
          {isPartial
            ? `Pagaste la seña de $${amountPaid.toLocaleString("es-AR")}. Te queda un saldo de $${amountPending.toLocaleString("es-AR")} para abonar en el club.`
            : "El pago se acreditó correctamente."}
        </p>
      </div>
    );
  } else if (payState === "offline") {
    const isCash = payNorm === "cash_pending";
    headerBlock = (
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700 shadow-inner dark:bg-emerald-950/50 dark:text-emerald-300">
          ✓
        </div>
        <h1 className="text-center text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
          {isCash ? "Reserva registrada" : "Reserva con transferencia"}
        </h1>
        <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-300">
          {isCash
            ? "Pagás en efectivo cuando llegues al club. El club confirmará el cobro."
            : "Realizá la transferencia por el monto indicado y enviá el comprobante al club. Te avisaremos cuando confirmen el pago."}
        </p>
      </div>
    );
  } else if (payState === "pending") {
    headerBlock = (
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-3xl text-amber-700 shadow-inner">
          …
        </div>
        <h1 className="text-center text-xl font-semibold tracking-tight text-slate-950">Pago en proceso…</h1>
        <p className="text-center text-sm font-medium text-amber-800">
          Tu pago está siendo procesado por Mercado Pago. Te confirmaremos cuando se acredite.
        </p>
      </div>
    );
  } else {
    headerBlock = (
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-3xl text-rose-700 shadow-inner">
          ✕
        </div>
        <h1 className="text-center text-xl font-semibold tracking-tight text-slate-950">Pago rechazado</h1>
        <p className="text-center text-sm font-medium text-rose-800">
          No se pudo completar el pago. Probá con otro medio o contactá a tu banco.
        </p>
        <Link
          href={isReservation ? "/reservas/nueva" : "/crear-partido"}
          className={`mt-2 inline-flex justify-center ${PLAYER_PRIMARY_BUTTON} px-6 py-3 text-base`}
        >
          {isReservation ? "Reintentar reserva" : "Reintentar pago"}
        </Link>
      </div>
    );
  }

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      {/* El webhook de MP puede tardar unos segundos en confirmar el pago:
          si esta fila cambia mientras el jugador esta acá, se refresca solo. */}
      <MatchesRealtimeRefresh channelName={`reserva-confirmacion:${id}`} filter={`id=eq.${id}`} />
      {params.error === "sim" ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-800">
          No se pudo simular el pago. Probá de nuevo o revisá que seas el titular de la reserva.
        </p>
      ) : null}
      {headerBlock}

      <section className={`${PLAYER_CARD} w-full space-y-3 overflow-hidden p-5`}>
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">Club</span>
          <span className="min-w-0 break-words text-right font-semibold text-slate-900">{clubLabel}</span>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">Cancha</span>
          <span className="min-w-0 break-words text-right font-semibold text-slate-900">{courtLabel}</span>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">Fecha</span>
          <span className="font-semibold capitalize text-slate-900">{fechaFormateada}</span>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">Hora</span>
          <span className="font-semibold text-slate-900">{timeStr || "—"}</span>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium text-slate-500">Duración</span>
          <span className="font-semibold text-slate-900">{duration} min</span>
        </div>
      </section>

      {showDevSim ? (
        <section className={`${PLAYER_CARD} space-y-3 p-5`}>
          <p className="text-sm font-medium text-slate-600">
            Modo desarrollo: simulá un pago aprobado sin pasar por Mercado Pago.
          </p>
          <form action={simulatePaymentApproved}>
            <input type="hidden" name="match_id" value={id} />
            <button
              type="submit"
              className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              Simular pago aprobado
            </button>
          </form>
        </section>
      ) : null}

      <div className="flex flex-col gap-3">
        <Link href="/reservas" className={`inline-flex justify-center ${PLAYER_PRIMARY_BUTTON} py-3.5 text-base`}>
          Ver mis reservas
        </Link>
        <Link
          href="/home"
          className="inline-flex justify-center rounded-2xl py-3 text-center text-sm font-semibold text-[#0085FC] transition hover:bg-[#0085FC]/5"
        >
          Volver al inicio
        </Link>
      </div>
    </MotionPage>
  );
}
