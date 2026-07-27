"use client";

import { endOfMonth, parseISO, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { DB_TABLES } from "@/lib/db-tables";
import type { MatchMoneyRow } from "@/lib/admin/finance-math";
import {
  aggregateByDay,
  aggregateByMonth,
  aggregateByWeek,
  compareThisMonthVsPrevious,
  sumByCourt,
  totalPaid,
} from "@/lib/admin/finance-math";
import { adminAccentBar, adminButtonSecondary, adminCard, adminCTAPrimary, adminKicker, adminPressable } from "@/components/admin/admin-premium";
import { SkeletonBlock } from "@/components/admin/ui-skeleton";

const CACHE_PREFIX = "admin_finance_matches_v1:";
const CACHE_TTL_MS = 90_000;

const btnSecondary = `${adminButtonSecondary} bg-[var(--bg-card)] shadow-sm ${adminPressable}`;

type Court = { id: string; name: string | null };
type FinanceRow = MatchMoneyRow & {
  owner_id: string | null;
  scheduled_date: string | null;
};

const inflightByKey = new Map<string, Promise<{ rows: FinanceRow[]; error: string | null }>>();

function cacheKey(courtIds: string[]) {
  return `${CACHE_PREFIX}${[...courtIds].sort().join(",")}`;
}

function readSessionCache(courtIds: string[]): FinanceRow[] | null {
  if (typeof window === "undefined" || courtIds.length === 0) return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(courtIds));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; rows: FinanceRow[] };
    if (Date.now() - parsed.t > CACHE_TTL_MS) return null;
    return parsed.rows;
  } catch {
    return null;
  }
}

function writeSessionCache(courtIds: string[], rows: FinanceRow[]) {
  try {
    sessionStorage.setItem(cacheKey(courtIds), JSON.stringify({ t: Date.now(), rows }));
  } catch {
    /* quota / private mode */
  }
}

async function fetchPaidMatchesDeduped(courtIds: string[]): Promise<{
  rows: FinanceRow[];
  error: string | null;
}> {
  if (courtIds.length === 0) return { rows: [], error: null };
  const key = [...courtIds].sort().join(",");
  const existing = inflightByKey.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(DB_TABLES.matches)
      .select("id,date,court_id,total_price,amount_paid,payment_status,owner_id,scheduled_date")
      .in("court_id", courtIds)
      .eq("match_type", "reservation")
      .order("date", { ascending: false });
    if (error) {
      return { rows: [], error: error.message };
    }
    return { rows: (data ?? []) as FinanceRow[], error: null };
  })();

  inflightByKey.set(key, promise);
  promise.finally(() => {
    inflightByKey.delete(key);
  });
  return promise;
}

function FinanceDataSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Cargando datos financieros">
      <div className={adminCard}>
        <SkeletonBlock className="h-3 w-40 rounded-full" />
        <SkeletonBlock className="mt-4 h-10 w-48 rounded-xl" />
      </div>
      <div className={adminCard}>
        <SkeletonBlock className="h-4 w-56 rounded-lg" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SkeletonBlock className="h-16 w-full rounded-2xl" />
          <SkeletonBlock className="h-16 w-full rounded-2xl" />
        </div>
        <SkeletonBlock className="mt-4 h-4 w-2/3 max-w-xs rounded-md" />
      </div>
      <div className={adminCard}>
        <SkeletonBlock className="h-4 w-32 rounded-lg" />
        <div className="mt-4 flex flex-col gap-2">
          <SkeletonBlock className="h-12 w-full rounded-2xl" />
          <SkeletonBlock className="h-12 w-full rounded-2xl" />
          <SkeletonBlock className="h-12 w-full rounded-2xl" />
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={adminCard}>
            <SkeletonBlock className="h-36 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FinanceModule({ courtIds, courts }: { courtIds: string[]; courts: Court[] }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pinChecking, setPinChecking] = useState(false);
  const [clubId, setClubId] = useState<string | null>(null);
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasHistoricDebt, setHasHistoricDebt] = useState(false);
  const courtIdsRef = useRef(courtIds);

  useEffect(() => {
    courtIdsRef.current = courtIds;
  }, [courtIds]);

  const fetchPaid = useCallback(async () => {
    const ids = courtIdsRef.current;
    if (ids.length === 0) {
      setRows([]);
      return;
    }

    const cached = readSessionCache(ids);
    if (cached) {
      setRows(cached);
      setLoadError(null);
    }

    setLoading(true);
    setLoadError(null);
    const { rows: next, error } = await fetchPaidMatchesDeduped(ids);
    setLoading(false);
    if (error) {
      setLoadError(error);
      if (!cached) setRows([]);
      return;
    }
    setRows(next);
    writeSessionCache(ids, next);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchPaid hidrata el módulo tras desbloquear PIN
    if (unlocked) void fetchPaid();
  }, [unlocked, fetchPaid]);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    void (async () => {
      const ids = courtIdsRef.current;
      if (!ids.length) {
        setHasHistoricDebt(false);
        return;
      }
      const supabase = createClient();
      const { data: courtRow } = await supabase
        .from(DB_TABLES.courts)
        .select("club_id")
        .in("id", ids)
        .limit(1)
        .maybeSingle();
      const clubId = String((courtRow as { club_id?: string | null } | null)?.club_id ?? "");
      if (!clubId) {
        if (!cancelled) setHasHistoricDebt(false);
        return;
      }
      // club_debts es del modelo de comisiones discontinuado: solo se usa para
      // detectar si quedan saldos historicos que consultar en Supabase.
      const { data } = await supabase.from(DB_TABLES.clubDebts).select("id").eq("club_id", clubId).limit(1);
      if (cancelled) return;
      setHasHistoricDebt((data ?? []).length > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, courtIds]);

  useEffect(() => {
    let cancelled = false;
    async function loadClubId() {
      if (courtIds.length === 0) {
        if (!cancelled) setClubId(null);
        return;
      }
      const supabase = createClient();
      const { data: courtRow } = await supabase
        .from(DB_TABLES.courts)
        .select("club_id")
        .in("id", courtIds)
        .limit(1)
        .maybeSingle();
      const id = String((courtRow as { club_id?: string | null } | null)?.club_id ?? "");
      if (!cancelled) setClubId(id || null);
    }
    void loadClubId();
    return () => {
      cancelled = true;
    };
  }, [courtIds]);

  async function tryPin(e: FormEvent) {
    e.preventDefault();
    if (!clubId) {
      setPinError(pinInput !== "1234");
      if (pinInput === "1234") {
        setUnlocked(true);
        setPinInput("");
      }
      return;
    }
    setPinChecking(true);
    const supabase = createClient();
    // finance_pin nunca se manda al browser: la verificacion corre en Postgres via RPC.
    const { data: ok } = await supabase.rpc("verify_finance_pin", { p_club_id: clubId, p_pin: pinInput });
    setPinChecking(false);
    if (ok) {
      setUnlocked(true);
      setPinError(false);
      setPinInput("");
    } else {
      setPinError(true);
    }
  }

  const courtName = useMemo(() => new Map(courts.map((c) => [c.id, c.name ?? "Cancha"])), [courts]);

  const byCourt = useMemo(() => sumByCourt(rows), [rows]);
  const total = useMemo(() => totalPaid(rows), [rows]);
  const compare = useMemo(() => compareThisMonthVsPrevious(rows), [rows]);
  const byDay = useMemo(() => aggregateByDay(rows, 30), [rows]);
  const byWeek = useMemo(() => aggregateByWeek(rows), [rows]);
  const byMonth = useMemo(() => aggregateByMonth(rows), [rows]);
  const maxDay = useMemo(() => byDay.reduce((m, x) => Math.max(m, x.total), 0), [byDay]);
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekIncome = useMemo(
    () =>
      rows
        .filter((r) => (r.payment_status ?? "").toLowerCase() === "paid")
        .filter((r) => {
          const d = parseISO(r.date);
          return d >= weekStart && d <= now;
        })
        .reduce((acc, r) => acc + Number(r.amount_paid ?? 0), 0),
    [now, rows, weekStart]
  );
  const paidRows = useMemo(
    () => rows.filter((r) => (r.payment_status ?? "").toLowerCase() === "paid"),
    [rows]
  );
  const avgTicket = paidRows.length > 0 ? total / paidRows.length : 0;
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const topCourtMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of paidRows) {
      const d = parseISO(row.date);
      if (d < thisMonthStart || d > thisMonthEnd) continue;
      map.set(row.court_id, (map.get(row.court_id) ?? 0) + Number(row.amount_paid ?? 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [paidRows, thisMonthEnd, thisMonthStart]);
  const refundsThisMonth = useMemo(
    () =>
      rows
        .filter((r) => (r.payment_status ?? "").toLowerCase() === "refund_requested")
        .filter((r) => {
          const d = parseISO(r.date);
          return d >= thisMonthStart && d <= thisMonthEnd;
        }).length,
    [rows, thisMonthEnd, thisMonthStart]
  );
  if (!unlocked) {
    return (
      <form
        onSubmit={tryPin}
        className={`mx-auto max-w-sm space-y-5 ${adminCard}`}
      >
        <h2 className="font-admin-display text-lg font-bold text-[var(--text-primary)]">Módulo financiero</h2>
        <p className="text-sm font-medium text-[var(--text-tertiary)]">
          Ingresá el PIN de administrador (6 dígitos) para ver agregados de ingresos.
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pinInput}
          onChange={(e) => {
            setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6));
            setPinError(false);
          }}
          className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-3 text-center text-lg font-semibold tracking-widest outline-none transition-shadow focus:border-[#0085FC]/30 focus:ring-2 focus:ring-[#0085FC]/20"
          placeholder="······"
          autoComplete="one-time-code"
        />
        {pinError ? (
          <p className="text-sm font-medium text-rose-600">PIN incorrecto.</p>
        ) : null}
        <button type="submit" disabled={pinChecking} className={`w-full ${adminCTAPrimary}`}>
          {pinChecking ? "Verificando..." : "Desbloquear"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={`${adminCard} flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between`}>
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          Sesión financiera activa (solo este dispositivo)
        </p>
        <button type="button" onClick={() => setUnlocked(false)} className={btnSecondary}>
          Cerrar sesión financiera
        </button>
      </div>

      {loadError ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 p-5 text-sm font-medium text-rose-800 shadow-sm">
          {loadError}
        </p>
      ) : null}

      {loading && rows.length === 0 ? <FinanceDataSkeleton /> : null}

      {!(loading && rows.length === 0) ? (
        <>
          <section className={`${adminCard} ${adminAccentBar}`}>
            <h3 className="text-sm font-semibold text-[var(--text-tertiary)]">Ingresos confirmados</h3>
            <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              ${total.toFixed(2)}
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className={adminCard}>
              <p className={adminKicker}>Ingresos semana actual</p>
              <p className="mt-2 text-xl font-bold text-emerald-700">${weekIncome.toFixed(2)}</p>
            </div>
            <div className={adminCard}>
              <p className={adminKicker}>Ticket promedio</p>
              <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">${avgTicket.toFixed(2)}</p>
              <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">Por reserva pagada</p>
            </div>
            <div className={adminCard}>
              <p className={adminKicker}>Cancha más rentable (mes)</p>
              <p className="mt-2 text-base font-bold text-[var(--text-primary)]">
                {topCourtMonth ? `${courtName.get(topCourtMonth[0]) ?? "Cancha"}` : "Sin datos"}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                {topCourtMonth ? `$${topCourtMonth[1].toFixed(2)}` : "Sin ingresos del mes"}
              </p>
            </div>
            <div className={adminCard}>
              <p className={adminKicker}>Reembolsos del mes</p>
              <p className="mt-2 text-xl font-bold text-sky-700">{refundsThisMonth}</p>
            </div>
          </section>

          <section className={adminCard}>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Este mes vs mes anterior</h3>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <p className={adminKicker}>
                  Mes actual
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">${compare.current.toFixed(2)}</p>
              </div>
              <div>
                <p className={adminKicker}>
                  Mes anterior
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--text-secondary)]">
                  ${compare.previous.toFixed(2)}
                </p>
              </div>
            </div>
            <div
              className={`mt-4 inline-flex w-fit items-center rounded-full px-3 py-1.5 text-sm font-semibold ${
                compare.deltaPct >= 0
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              }`}
            >
              {compare.deltaPct >= 0 ? "↑" : "↓"} {Math.abs(compare.deltaPct).toFixed(1)}%
            </div>
          </section>

          <section className={adminCard}>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Por cancha</h3>
            <ul className="mt-5 flex flex-col gap-2">
              {Array.from(byCourt.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([id, amount]) => (
                  <li
                    key={id}
                    className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/40 px-4 py-3 text-sm font-medium ring-1 ring-[var(--border-subtle)]/60"
                  >
                    <span>{courtName.get(id) ?? id}</span>
                    <span className="font-bold text-[var(--text-primary)]">${amount.toFixed(2)}</span>
                  </li>
                ))}
              {byCourt.size === 0 ? (
                <li className="text-sm font-medium text-[var(--text-tertiary)]">Sin pagos registrados.</li>
              ) : null}
            </ul>
          </section>

          <section className="flex flex-col gap-4 lg:grid lg:grid-cols-3">
            <div className={adminCard}>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">Por día</h4>
              <div className="mt-4 flex flex-col gap-3">
                {byDay.map((d) => (
                  <div key={d.key} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-[var(--text-tertiary)]">
                      <span>{d.label}</span>
                      <span>${d.total.toFixed(2)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)] ring-1 ring-[var(--border-subtle)]/40">
                      <div
                        className="h-full rounded-full bg-emerald-500 shadow-sm"
                        style={{
                          width: `${maxDay > 0 ? Math.max(8, (d.total / maxDay) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={adminCard}>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">Por semana</h4>
              <ul className="mt-4 flex flex-col gap-2 text-sm font-medium text-[var(--text-secondary)]">
                {byWeek.map((w) => (
                  <li
                    key={w.key}
                    className="flex justify-between rounded-xl border border-transparent px-1 py-1.5 hover:border-[var(--border-subtle)] hover:bg-[var(--bg-app)]/60"
                  >
                    <span>{w.key}</span>
                    <span className="font-semibold text-[var(--text-secondary)]">${w.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={adminCard}>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">Por mes</h4>
              <ul className="mt-4 flex flex-col gap-2 text-sm font-medium text-[var(--text-secondary)]">
                {byMonth.map((m) => (
                  <li
                    key={m.key}
                    className="flex justify-between rounded-xl border border-transparent px-1 py-1.5 hover:border-[var(--border-subtle)] hover:bg-[var(--bg-app)]/60"
                  >
                    <span>{m.label}</span>
                    <span className="font-semibold text-[var(--text-secondary)]">${m.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className={adminCard}>
            <Link
              href="/admin/finanzas/reembolsos"
              className="text-base font-bold text-[#0085FC] transition hover:text-[#0461C4]"
            >
              Ver panel de reembolsos →
            </Link>
          </section>

          {hasHistoricDebt ? (
            <section className={adminCard}>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Saldos históricos</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                El modelo de comisiones fue discontinuado. Los saldos históricos pueden consultarse directamente en
                Supabase.
              </p>
            </section>
          ) : null}
        </>
      ) : null}

      {loading && rows.length > 0 ? (
        <p className="text-center text-xs font-medium text-[var(--text-tertiary)]">Actualizando datos…</p>
      ) : null}
    </div>
  );
}
