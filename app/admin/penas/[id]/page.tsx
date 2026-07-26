import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PlayerAvatar } from "@/components/admin/admin-status-pills";
import {
  adminBadgeDanger,
  adminBadgeLima,
  adminBadgeNeutral,
  adminBadgePending,
  adminBadgeSuccess,
  adminButtonSecondary,
  adminCard,
  adminCTAPrimary,
  adminEmptyState,
  adminKicker,
  adminSectionLabel,
  adminTitle,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { PENA_PAYMENT_METHOD_LABELS, penaStatusMeta } from "@/lib/pena-constants";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import {
  cancelPenaAction,
  cancelPenaRegistrationByAdminAction,
  confirmPenaOfflinePaymentAction,
  finishPenaAction,
  generatePenaFirstRoundAction,
  publishPenaAction,
  startPenaAction,
} from "../actions";
import { PenaRoundMatches } from "./pena-round-matches";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ok?: string; error?: string; warn?: string }>;
};

export const dynamic = "force-dynamic";

function redirectUrl(basePath: string, res: { ok: boolean; error?: string }, successMessage: string): string {
  if (!res.ok) return `${basePath}?error=${encodeURIComponent(res.error ?? "Ocurrió un error.")}`;
  if (res.error) return `${basePath}?ok=${encodeURIComponent(successMessage)}&warn=${encodeURIComponent(res.error)}`;
  return `${basePath}?ok=${encodeURIComponent(successMessage)}`;
}

const paymentStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: adminBadgePending },
  confirmed: { label: "Confirmado", className: adminBadgeSuccess },
  refunded: { label: "Reembolsado", className: adminBadgeNeutral },
};

export default async function AdminPenaDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
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

  const pena = p as {
    club_id: string;
    name: string;
    description: string | null;
    what_includes: string[] | null;
    date: string;
    start_time: string;
    duration_minutes: number;
    level: string;
    game_format: string | null;
    max_players: number;
    price_per_player: number;
    accepts_mp: boolean;
    accepts_cash: boolean;
    accepts_transfer: boolean;
    transfer_alias: string | null;
    cancellation_hours: number;
    status: string;
  };
  if (!ctx.clubIds.includes(pena.club_id)) redirect("/admin/penas");

  const service = createServiceClient();
  const [{ data: regs }, { data: courts }, { data: matches }] = await Promise.all([
    service
      .from(DB_TABLES.penaRegistrations)
      .select("id, player_id, status, payment_method, payment_status, registered_at")
      .eq("pena_id", id)
      .order("registered_at", { ascending: true }),
    service.from(DB_TABLES.courts).select("id, name").eq("club_id", pena.club_id).order("name", { ascending: true }),
    pena.status === "in_progress"
      ? service
          .from(DB_TABLES.penaRoundMatches)
          .select("id, match_order, pair1_player1_id, pair1_player2_id, pair2_player1_id, pair2_player2_id, court_id")
          .eq("pena_id", id)
          .order("match_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const regList = (regs ?? []) as Array<{
    id: string;
    player_id: string;
    status: string;
    payment_method: string | null;
    payment_status: string;
    registered_at: string;
  }>;
  const playerIds = [...new Set(regList.map((r) => r.player_id))];
  const { data: profiles } = playerIds.length
    ? await service.from(DB_TABLES.profiles).select("user_id, name, avatar_url").in("user_id", playerIds)
    : { data: [] };
  const profileMap = new Map(
    ((profiles ?? []) as Array<{ user_id: string; name: string | null; avatar_url: string | null }>).map((pr) => [
      pr.user_id,
      pr,
    ])
  );

  const registered = regList.filter((r) => r.status === "registered");
  const waitlist = regList.filter((r) => r.status === "waitlist");
  const courtList = (courts ?? []) as Array<{ id: string; name: string }>;
  const matchList = (matches ?? []) as Array<{
    id: string;
    match_order: number;
    pair1_player1_id: string | null;
    pair1_player2_id: string | null;
    pair2_player1_id: string | null;
    pair2_player2_id: string | null;
    court_id: string | null;
  }>;

  const meta = penaStatusMeta(pena.status);
  const okMsg = sp?.ok ? decodeURIComponent(sp.ok) : "";
  const warnMsg = sp?.warn ? decodeURIComponent(sp.warn) : "";
  const errMsg = sp?.error ? decodeURIComponent(sp.error) : "";

  async function handlePublish() {
    "use server";
    const res = await publishPenaAction(id);
    redirect(redirectUrl(`/admin/penas/${id}`, res, "Peña publicada."));
  }

  async function handleCancelPena() {
    "use server";
    const res = await cancelPenaAction(id);
    redirect(redirectUrl(`/admin/penas/${id}`, res, "Peña cancelada."));
  }

  async function handleStart() {
    "use server";
    const res = await startPenaAction(id);
    redirect(redirectUrl(`/admin/penas/${id}`, res, "Peña iniciada."));
  }

  async function handleFinish() {
    "use server";
    const res = await finishPenaAction(id);
    redirect(redirectUrl(`/admin/penas/${id}`, res, "Peña finalizada."));
  }

  async function handleGenerateFirstRound() {
    "use server";
    const res = await generatePenaFirstRoundAction(id);
    redirect(redirectUrl(`/admin/penas/${id}`, res, "Primera ronda generada."));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pb-28 pt-6 md:pb-10">
      <Link href="/admin/penas" className="inline-flex items-center gap-1 text-sm font-medium text-[#0461C4] dark:text-sky-400">
        <ChevronLeft size={18} />
        Peñas
      </Link>

      {okMsg ? (
        <p className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          {okMsg}
        </p>
      ) : null}
      {warnMsg ? (
        <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {warnMsg}
        </p>
      ) : null}
      {errMsg ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100">
          {errMsg}
        </p>
      ) : null}

      {/* Sección 1: info y acciones */}
      <header className={adminCard}>
        <p className={adminKicker}>{pena.level}{pena.game_format ? ` · ${pena.game_format}` : ""}</p>
        <h1 className={`mt-1 ${adminTitle}`}>{pena.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span className={meta.className}>{meta.label}</span>
          {registered.length}/{pena.max_players} jugadores
        </p>
        {pena.description ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{pena.description}</p> : null}
        {pena.what_includes && pena.what_includes.length > 0 ? (
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">Incluye: {pena.what_includes.join(", ")}</p>
        ) : null}
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {pena.date} · {pena.start_time.slice(0, 5)} · {pena.duration_minutes} min
        </p>
        <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">
          Precio: ${Math.round(Number(pena.price_per_player)).toLocaleString("es-AR")} por jugador
        </p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Métodos de pago:{" "}
          {[pena.accepts_mp && "Mercado Pago", pena.accepts_cash && "Efectivo", pena.accepts_transfer && "Transferencia"]
            .filter(Boolean)
            .join(", ")}
          {pena.accepts_transfer && pena.transfer_alias ? ` (alias: ${pena.transfer_alias})` : ""}
        </p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">Cancelación hasta {pena.cancellation_hours}hs antes.</p>
      </header>

      <section className="flex flex-wrap gap-2">
        {pena.status === "draft" ? (
          <>
            <Link href={`/admin/penas/${id}/editar`} className={adminButtonSecondary}>
              Editar
            </Link>
            <form action={handlePublish}>
              <button type="submit" className={adminCTAPrimary}>
                Publicar
              </button>
            </form>
          </>
        ) : null}
        {pena.status === "published" ? (
          <>
            <form action={handleStart}>
              <button type="submit" className={adminCTAPrimary}>
                Iniciar peña
              </button>
            </form>
            <form action={handleCancelPena}>
              <button type="submit" className={adminBadgeDanger}>
                Cancelar
              </button>
            </form>
          </>
        ) : null}
        {pena.status === "in_progress" ? (
          <form action={handleFinish}>
            <button type="submit" className={adminCTAPrimary}>
              Finalizar peña
            </button>
          </form>
        ) : null}
      </section>

      {/* Sección 2: inscriptos */}
      <section>
        <h2 className={`mb-3 ${adminSectionLabel}`}>Inscriptos</h2>
        {registered.length === 0 ? (
          <div className={adminEmptyState}>Todavía no hay inscriptos.</div>
        ) : (
          <ul className="space-y-2">
            {registered.map((r) => {
              const profile = profileMap.get(r.player_id);
              const name = profile?.name ?? "Jugador";
              const payMeta = paymentStatusMeta[r.payment_status] ?? { label: r.payment_status, className: adminBadgeNeutral };
              const methodLabel = r.payment_method ? PENA_PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method : "—";
              const canConfirm = r.payment_status === "pending" && (r.payment_method === "cash" || r.payment_method === "transfer");

              async function confirmPayment() {
                "use server";
                const res = await confirmPenaOfflinePaymentAction(r.id);
                redirect(redirectUrl(`/admin/penas/${id}`, res, "Pago confirmado."));
              }

              async function cancelRegistration() {
                "use server";
                const res = await cancelPenaRegistrationByAdminAction(r.id);
                redirect(redirectUrl(`/admin/penas/${id}`, res, "Inscripción cancelada."));
              }

              return (
                <li key={r.id} className={`${adminCard} flex flex-wrap items-center justify-between gap-3`}>
                  <div className="flex min-w-0 items-center gap-3">
                    {profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
                      <img src={profile.avatar_url} alt={name} className="h-10 w-10 shrink-0 rounded-full border border-[var(--border-subtle)] object-cover" />
                    ) : (
                      <PlayerAvatar name={name} />
                    )}
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={adminBadgeLima}>Inscripto</span>
                    <span className="text-[var(--text-secondary)]">{methodLabel}</span>
                    <span className={payMeta.className}>{payMeta.label}</span>
                    {canConfirm ? (
                      <form action={confirmPayment}>
                        <button type="submit" className={adminBadgeSuccess}>
                          Confirmar pago
                        </button>
                      </form>
                    ) : null}
                    <form action={cancelRegistration}>
                      <button type="submit" className={adminBadgeDanger}>
                        Cancelar inscripción
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {waitlist.length > 0 ? (
          <div className="mt-4">
            <h3 className={`mb-2 ${adminSectionLabel}`}>Lista de espera</h3>
            <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
              {waitlist.map((r) => (
                <li key={r.id}>{profileMap.get(r.player_id)?.name ?? "Jugador"}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Sección 3: primera ronda */}
      {pena.status === "in_progress" ? (
        <section>
          <h2 className={`mb-3 ${adminSectionLabel}`}>Primera ronda</h2>
          {matchList.length === 0 ? (
            <div className={adminEmptyState}>
              <p>Todavía no se generó la ronda.</p>
              <form action={handleGenerateFirstRound} className="mt-4 inline-block">
                <button type="submit" className={adminCTAPrimary}>
                  Generar primera ronda
                </button>
              </form>
            </div>
          ) : (
            <PenaRoundMatches
              matches={matchList}
              players={registered.map((r) => ({ id: r.player_id, name: profileMap.get(r.player_id)?.name ?? "Jugador" }))}
              courts={courtList}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
