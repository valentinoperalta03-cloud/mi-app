import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminInputClass } from "@/components/admin/admin-form-input";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { adminAccentBar, adminBadgeBrand, adminCTADanger, adminBadgeSuccess, adminCard, adminEmptyState, adminKicker } from "@/components/admin/admin-premium";
import { AdminPressableSurface } from "@/components/admin/admin-pressable";
import { PlayerAvatar, PlayerSegmentPill } from "@/components/admin/admin-status-pills";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

const NEW_DAYS = 21;
const SLOT_MINUTES = 90;

function hhmmFromDate(dateIso: string): string {
  return format(parseISO(dateIso), "HH:mm");
}

function slotKeyFromTime(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "00:00";
  const total = h * 60 + m;
  const rounded = Math.round(total / SLOT_MINUTES) * SLOT_MINUTES;
  const rh = Math.floor((rounded % (24 * 60)) / 60);
  const rm = rounded % 60;
  return `${String(rh).padStart(2, "0")}:${String(rm).padStart(2, "0")}`;
}

function formatPosition(value: string | null): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "drive") return "Drive";
  if (v === "reves" || v === "revés") return "Revés";
  if (v === "ambas") return "Ambas";
  return "No definida";
}

export default async function AdminJugadoresPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: matchesRaw } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.matches)
          .select("id,owner_id,date,scheduled_time,match_type")
          .in("court_id", ctx.courtIds)
          .not("owner_id", "is", null)
          .eq("match_type", "reservation")
          .order("date", { ascending: false })
      : { data: [] };

  const matchRows = (matchesRaw ?? []) as {
    id: string;
    owner_id: string | null;
    date: string;
    scheduled_time: string | null;
    match_type: string | null;
  }[];
  const clubMatchIds = matchRows.map((m) => m.id);

  const { data: participationsRaw } = clubMatchIds.length
    ? await supabase
        .from(DB_TABLES.matchParticipants)
        .select("player_id,match_id")
        .in("match_id", clubMatchIds)
    : { data: [] };
  const participations = (participationsRaw ?? []) as { player_id: string; match_id: string }[];

  const matchesById = new Map(matchRows.map((m) => [m.id, m]));
  const byUser = new Map<
    string,
    {
      reservationsCreated: number;
      totalPlayed: number;
      first: string;
      last: string;
      matchIds: Set<string>;
      slotCounts: Map<string, number>;
    }
  >();

  function upsertUserMatch(uid: string, matchId: string, source: "owner" | "participant") {
    const match = matchesById.get(matchId);
    if (!match) return;
    const matchDate = match.date;
    const timeValue = String(match.scheduled_time ?? "").slice(0, 5) || hhmmFromDate(matchDate);
    const slotKey = slotKeyFromTime(timeValue);
    const current = byUser.get(uid);
    if (!current) {
      byUser.set(uid, {
        reservationsCreated: source === "owner" ? 1 : 0,
        totalPlayed: 1,
        first: matchDate,
        last: matchDate,
        matchIds: new Set([matchId]),
        slotCounts: new Map([[slotKey, 1]]),
      });
      return;
    }
    if (source === "owner") current.reservationsCreated += 1;
    if (!current.matchIds.has(matchId)) {
      current.matchIds.add(matchId);
      current.totalPlayed += 1;
      current.slotCounts.set(slotKey, (current.slotCounts.get(slotKey) ?? 0) + 1);
    }
    if (parseISO(matchDate) > parseISO(current.last)) current.last = matchDate;
    if (parseISO(matchDate) < parseISO(current.first)) current.first = matchDate;
  }

  for (const r of matchRows) {
    const uid = r.owner_id;
    if (!uid) continue;
    upsertUserMatch(uid, r.id, "owner");
  }
  for (const p of participations) {
    if (!p.player_id) continue;
    upsertUserMatch(p.player_id, p.match_id, "participant");
  }

  const userIds = Array.from(byUser.keys());
  const { data: profilesRaw } = userIds.length
    ? await supabase
        .from(DB_TABLES.profiles)
        .select("user_id,name,avatar_url,level,category,preferred_hand,court_position,preferred_schedule")
        .in("user_id", userIds)
    : { data: [] };

  const profileData = new Map(
    (profilesRaw ?? []).map((p: {
      user_id: string;
      name: string | null;
      avatar_url: string | null;
      level: number | null;
      category: string | null;
      preferred_hand: string | null;
      court_position: string | null;
      preferred_schedule: string | null;
    }) => [
      p.user_id,
      {
        name: p.name ?? "Jugador",
        avatarUrl: p.avatar_url ?? null,
        level: p.level ?? null,
        category: p.category ?? null,
        preferredHand: p.preferred_hand ?? null,
        courtPosition: p.court_position ?? null,
        preferredSchedule: p.preferred_schedule ?? null,
      },
    ])
  );

  const { data: paymentsRaw } = userIds.length && clubMatchIds.length
    ? await supabase
        .from(DB_TABLES.payments)
        .select("user_id,status,match_id")
        .in("user_id", userIds)
        .in("match_id", clubMatchIds)
    : { data: [] };
  const paymentRows = (paymentsRaw ?? []) as { user_id: string; status: string | null; match_id: string }[];
  const paymentStats = new Map<string, { approved: number; cancelled: number }>();
  for (const pay of paymentRows) {
    const uid = pay.user_id;
    const status = String(pay.status ?? "").toLowerCase();
    const cur = paymentStats.get(uid) ?? { approved: 0, cancelled: 0 };
    if (status === "approved") cur.approved += 1;
    if (status === "refund_requested" || status === "cancelled") cur.cancelled += 1;
    paymentStats.set(uid, cur);
  }

  const now = new Date();
  const list = userIds
    .map((uid) => {
      const stats = byUser.get(uid)!;
      const firstDt = parseISO(stats.first);
      const daysSinceFirst = (now.getTime() - firstDt.getTime()) / (86400 * 1000);
      const segment = stats.totalPlayed === 1 || daysSinceFirst < NEW_DAYS ? ("Nuevo" as const) : ("Recurrente" as const);
      let favoriteSlot = "Sin historial";
      let maxSlotCount = 0;
      for (const [slot, count] of stats.slotCounts.entries()) {
        if (count > maxSlotCount) {
          maxSlotCount = count;
          favoriteSlot = slot;
        }
      }
      const pay = paymentStats.get(uid) ?? { approved: 0, cancelled: 0 };
      const totalForCancellation = pay.approved + pay.cancelled;
      const cancellationRate = totalForCancellation > 0 ? Math.round((pay.cancelled / totalForCancellation) * 100) : 0;
      const profile = profileData.get(uid);
      const category = String(profile?.category ?? "").trim();
      const level = Number(profile?.level ?? 0);
      const levelBadge =
        category || level > 0
          ? [category || null, level > 0 ? `Nivel ${level}` : null].filter(Boolean).join(" · ")
          : "Sin nivelar";
      return {
        uid,
        name: profile?.name ?? "Jugador",
        avatarUrl: profile?.avatarUrl ?? null,
        levelBadge,
        totalPlayed: stats.totalPlayed,
        reservationsCreated: stats.reservationsCreated,
        last: stats.last,
        segment,
        cancellationCount: pay.cancelled,
        cancellationRate,
        favoriteSlot,
        courtPosition: formatPosition(profile?.courtPosition ?? null),
        preferredHand: String(profile?.preferredHand ?? "").trim() || null,
      };
    })
    .sort((a, b) => b.totalPlayed - a.totalPlayed);

  const { data: blockedRaw } = ctx.clubIds.length
    ? await supabase
        .from(DB_TABLES.blockedUsers)
        .select("user_id")
        .eq("club_id", ctx.clubIds[0])
    : { data: [] };
  const blockedSet = new Set(
    (blockedRaw ?? []).map((r: { user_id: string }) => r.user_id)
  );

  async function blockPlayerAction(formData: FormData) {
    "use server";
    const userId = String(formData.get("user_id") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    if (!userId) return;
    const supabaseAction = await createClient({ allowCookieWrites: true });
    const actionCtx = await getOwnerAdminContext(supabaseAction);
    if (!actionCtx?.userId || !actionCtx.clubIds.length) return;
    await supabaseAction.from(DB_TABLES.blockedUsers).upsert({
      club_id: actionCtx.clubIds[0],
      user_id: userId,
      reason: reason || "Bloqueado desde panel admin",
    });
    revalidatePath("/admin/jugadores");
  }

  async function unblockPlayerAction(formData: FormData) {
    "use server";
    const userId = String(formData.get("user_id") ?? "").trim();
    if (!userId) return;
    const supabaseAction = await createClient({ allowCookieWrites: true });
    const actionCtx = await getOwnerAdminContext(supabaseAction);
    if (!actionCtx?.userId || !actionCtx.clubIds.length) return;
    await supabaseAction
      .from(DB_TABLES.blockedUsers)
      .delete()
      .eq("club_id", actionCtx.clubIds[0])
      .eq("user_id", userId);
    revalidatePath("/admin/jugadores");
  }

  const monthCutoff = new Date();
  monthCutoff.setDate(monthCutoff.getDate() - 30);
  const monthPlayers = list.filter((p) => parseISO(p.last) >= monthCutoff);
  const totalUniqueMonth = monthPlayers.length;
  const nuevos = monthPlayers.filter((p) => p.segment === "Nuevo").length;
  const recurrentes = monthPlayers.filter((p) => p.segment === "Recurrente").length;
  const topPlayer = list[0] ?? null;
  const nuevosRatio = totalUniqueMonth > 0 ? Math.round((nuevos / totalUniqueMonth) * 100) : 0;
  const retentionRate = list.length > 0 ? Math.round((list.filter((p) => p.totalPlayed > 1).length / list.length) * 100) : 0;
  const newThisMonth = list.filter((p) => parseISO(p.last) >= monthCutoff && p.segment === "Nuevo").length;

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <AdminPageHeader
        kicker="Análisis"
        title="Jugadores"
        subtitle="Actividad y retención de tu comunidad"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={adminCard}>
          <p className={adminKicker}>Total jugadores únicos (mes)</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{totalUniqueMonth}</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{newThisMonth} jugadores nuevos este mes</p>
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Nuevos vs recurrentes</p>
          <p className="mt-2 text-lg font-bold text-[var(--text-primary)]">{nuevos} / {recurrentes}</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div
              className="h-full rounded-full bg-[#0085FC]"
              style={{ width: `${Math.max(0, Math.min(100, nuevosRatio))}%` }}
            />
          </div>
        </div>
        <div className={`${adminCard} ${adminAccentBar}`}>
          <p className={adminKicker}>Jugador más activo</p>
          {topPlayer ? (
            <div className="mt-2 flex items-center gap-2">
              {topPlayer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
                <img src={topPlayer.avatarUrl} alt={topPlayer.name} className="h-8 w-8 rounded-full border border-[var(--border-subtle)] object-cover" />
              ) : (
                <PlayerAvatar name={topPlayer.name} />
              )}
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {topPlayer.name} ({topPlayer.totalPlayed})
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">Sin datos</p>
          )}
        </div>
        <div className={adminCard}>
          <p className={adminKicker}>Tasa de retención</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{retentionRate}%</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">Jugadores que volvieron más de una vez</p>
        </div>
      </section>

      {list.length === 0 ? (
        <p className={adminEmptyState}>
          Todavía no hay creadores de partidos en tus canchas.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((row) => (
            <li key={row.uid}>
              <AdminPressableSurface className={adminCard}>
                <div className="flex gap-4">
                  {row.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL pública de storage
                    <img src={row.avatarUrl} alt={row.name} className="h-12 w-12 rounded-full border border-[var(--border-subtle)] object-cover" />
                  ) : (
                    <PlayerAvatar name={row.name} />
                  )}
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-[var(--text-primary)]">{row.name}</p>
                        <p className="mt-0.5 text-xs font-medium text-[var(--text-tertiary)]">
                          ID: {row.uid.slice(0, 8)}…
                        </p>
                      </div>
                      <PlayerSegmentPill segment={row.segment} />
                    </div>
                    <dl className="grid grid-cols-1 gap-4 border-t border-[var(--border-subtle)] pt-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className={adminKicker}>Reservas creadas</dt>
                        <dd className="mt-1 font-semibold text-[var(--text-secondary)]">{row.reservationsCreated}</dd>
                      </div>
                      <div>
                        <dt className={adminKicker}>Última reserva</dt>
                        <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                          {format(parseISO(row.last), "d MMM yyyy HH:mm", { locale: es })}
                        </dd>
                      </div>
                      <div>
                        <dt className={adminKicker}>Estado</dt>
                        <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                          {blockedSet.has(row.uid) ? "Bloqueado" : "Activo"}
                        </dd>
                      </div>
                      <div>
                        <dt className={adminKicker}>Nivel ELO y categoría</dt>
                        <dd className="mt-1">
                          {row.levelBadge === "Sin nivelar" ? (
                            <span className="font-semibold text-[var(--text-secondary)]">Sin nivelar</span>
                          ) : (
                            <span className={adminBadgeBrand}>
                              {row.levelBadge}
                            </span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className={adminKicker}>Partidos totales en este club</dt>
                        <dd className="mt-1 font-semibold text-[var(--text-secondary)]">{row.totalPlayed} partidos jugados</dd>
                      </div>
                      <div>
                        <dt className={adminKicker}>Tasa de cancelación</dt>
                        <dd
                          className={`mt-1 font-semibold ${
                            row.cancellationRate > 30
                              ? "text-rose-700 dark:text-rose-400"
                              : "text-[var(--text-secondary)]"
                          }`}
                        >
                          {row.cancellationRate > 30 ? "⚠️ " : ""}
                          {row.cancellationCount} cancelaciones ({row.cancellationRate}%)
                        </dd>
                      </div>
                      <div>
                        <dt className={adminKicker}>Horario favorito</dt>
                        <dd className="mt-1 font-semibold text-[var(--text-secondary)]">
                          {row.favoriteSlot === "Sin historial" ? "Sin historial" : `Juega más a las ${row.favoriteSlot}hs`}
                        </dd>
                      </div>
                      <div>
                        <dt className={adminKicker}>Posición en cancha</dt>
                        <dd className="mt-1 font-semibold text-[var(--text-secondary)]">{row.courtPosition}</dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap items-center gap-2">
                      {!blockedSet.has(row.uid) ? (
                        <form action={blockPlayerAction} className="flex items-center gap-2">
                          <input type="hidden" name="user_id" value={row.uid} />
                          <input
                            name="reason"
                            placeholder="Motivo (opcional)"
                            className={`${adminInputClass} w-auto text-xs`}
                          />
                          <button type="submit" className={adminCTADanger}>
                            Bloquear
                          </button>
                        </form>
                      ) : (
                        <form action={unblockPlayerAction}>
                          <input type="hidden" name="user_id" value={row.uid} />
                          <button
                            type="submit"
                            className={adminBadgeSuccess}
                          >
                            Desbloquear
                          </button>
                        </form>
                      )}
                      <Link
                        href={`/admin/reservas?selected=&date=${format(parseISO(row.last), "yyyy-MM-dd")}`}
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                      >
                        Ver reservas
                      </Link>
                      {/* WhatsApp no se muestra si la columna no existe o está vacía */}
                    </div>
                  </div>
                </div>
              </AdminPressableSurface>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
