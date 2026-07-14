"use client";

import { endOfMonth, format, parseISO, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";
import { es } from "date-fns/locale";
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
import { adminCard, adminPressable } from "@/components/admin/admin-premium";
import { SkeletonBlock } from "@/components/admin/ui-skeleton";

const CACHE_PREFIX = "admin_finance_matches_v1:";
const CACHE_TTL_MS = 90_000;

const btnPrimary = `rounded-2xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.25)] ${adminPressable} hover:bg-slate-800 disabled:opacity-60 disabled:hover:scale-100 disabled:active:scale-100`;
const btnSecondary = `rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm ${adminPressable} hover:bg-slate-50/90 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800`;

type Court = { id: string; name: string | null };
type FinanceRow = MatchMoneyRow & {
  owner_id: string | null;
  scheduled_date: string | null;
};

type ClubDebtUiRow = {
  id: string;
  amount: number | null;
  payment_method: string | null;
  confirmed_at: string;
  match_id: string | null;
  matches:
    | { scheduled_date: string | null; scheduled_time: string | null }
    | { scheduled_date: string | null; scheduled_time: string | null }[]
    | null;
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
      .select("id,date,court_id,total_price,payment_status,owner_id,scheduled_date")
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
  const [expectedPin, setExpectedPin] = useState("1234");
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [debtRows, setDebtRows] = useState<ClubDebtUiRow[]>([]);
  const [debtLoadError, setDebtLoadError] = useState<string | null>(null);
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
        setDebtRows([]);
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
        if (!cancelled) setDebtRows([]);
        return;
      }
      const { data, error } = await supabase
        .from(DB_TABLES.clubDebts)
        .select("id, amount, payment_method, confirmed_at, match_id, matches(scheduled_date, scheduled_time)")
        .eq("club_id", clubId)
        .eq("status", "pending")
        .order("confirmed_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (error) {
        setDebtLoadError(error.message);
        setDebtRows([]);
        return;
      }
      setDebtLoadError(null);
      setDebtRows((data ?? []) as ClubDebtUiRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, courtIds]);

  useEffect(() => {
    let cancelled = false;
    async function loadExpectedPin() {
      if (courtIds.length === 0) {
        setExpectedPin("1234");
        return;
      }
      const supabase = createClient();
      const { data: courtRow } = await supabase
        .from(DB_TABLES.courts)
        .select("club_id")
        .in("id", courtIds)
        .limit(1)
        .maybeSingle();
      const clubId = String((courtRow as { club_id?: string | null } | null)?.club_id ?? "");
      if (!clubId) {
        setExpectedPin("1234");
        return;
      }
      const { data: clubRow } = await supabase
        .from(DB_TABLES.clubs)
        .select("finance_pin")
        .eq("id", clubId)
        .maybeSingle();
      const pin = String((clubRow as { finance_pin?: string | null } | null)?.finance_pin ?? "").trim();
      if (!cancelled) setExpectedPin(pin || "1234");
    }
    void loadExpectedPin();
    return () => {
      cancelled = true;
    };
  }, [courtIds]);

  function tryPin(e: FormEvent) {
    e.preventDefault();
    if (pinInput === expectedPin) {
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
        .reduce((acc, r) => acc + Number(r.total_price ?? 0), 0),
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
      map.set(row.court_id, (map.get(row.court_id) ?? 0) + Number(row.total_price ?? 0));
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
  const debtTotal = useMemo(
    () => debtRows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
    [debtRows]
  );

  if (!unlocked) {
    return (
      <form
        onSubmit={tryPin}
        className={`mx-auto max-w-sm space-y-5 ${adminCard}`}
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Módulo financiero</h2>
        <p className="text-sm font-medium text-slate-500">
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
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-lg font-semibold tracking-widest outline-none transition-shadow focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="······"
          autoComplete="one-time-code"
        />
        {pinError ? (
          <p className="text-sm font-medium text-rose-600">PIN incorrecto.</p>
        ) : null}
        <button type="submit" className={`w-full ${btnPrimary}`}>
          Desbloquear
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
          <section className={adminCard}>
            <h3 className="text-sm font-semibold text-slate-500">Ingresos confirmados (paid)</h3>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              ${total.toFixed(2)}
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className={adminCard}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ingresos semana actual</p>
              <p className="mt-2 text-xl font-bold text-emerald-700">${weekIncome.toFixed(2)}</p>
            </div>
            <div className={adminCard}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ticket promedio</p>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">${avgTicket.toFixed(2)}</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Por reserva pagada</p>
            </div>
            <div className={adminCard}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cancha más rentable (mes)</p>
              <p className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">
                {topCourtMonth ? `${courtName.get(topCourtMonth[0]) ?? "Cancha"}` : "Sin datos"}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {topCourtMonth ? `$${topCourtMonth[1].toFixed(2)}` : "Sin ingresos del mes"}
              </p>
            </div>
            <div className={adminCard}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reembolsos del mes</p>
              <p className="mt-2 text-xl font-bold text-sky-700">{refundsThisMonth}</p>
            </div>
          </section>

          <section className={adminCard}>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Este mes vs mes anterior</h3>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Mes actual
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">${compare.current.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Mes anterior
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-700 dark:text-slate-300">
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
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Por cancha</h3>
            <ul className="mt-5 flex flex-col gap-2">
              {Array.from(byCourt.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([id, amount]) => (
                  <li
                    key={id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100/90 bg-slate-50/40 px-4 py-3 text-sm font-medium ring-1 ring-slate-100/60 dark:border-slate-800 dark:bg-slate-900/40 dark:ring-slate-800/60"
                  >
                    <span>{courtName.get(id) ?? id}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">${amount.toFixed(2)}</span>
                  </li>
                ))}
              {byCourt.size === 0 ? (
                <li className="text-sm font-medium text-slate-500">Sin pagos registrados.</li>
              ) : null}
            </ul>
          </section>

          <section className="flex flex-col gap-4 lg:grid lg:grid-cols-3">
            <div className={adminCard}>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Por día</h4>
              <div className="mt-4 flex flex-col gap-3">
                {byDay.map((d) => (
                  <div key={d.key} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-500">
                      <span>{d.label}</span>
                      <span>${d.total.toFixed(2)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/40 dark:bg-slate-800 dark:ring-slate-700/40">
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
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Por semana</h4>
              <ul className="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                {byWeek.map((w) => (
                  <li
                    key={w.key}
                    className="flex justify-between rounded-xl border border-transparent px-1 py-1.5 hover:border-slate-100 hover:bg-slate-50/60 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                  >
                    <span>{w.key}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">${w.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={adminCard}>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Por mes</h4>
              <ul className="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                {byMonth.map((m) => (
                  <li
                    key={m.key}
                    className="flex justify-between rounded-xl border border-transparent px-1 py-1.5 hover:border-slate-100 hover:bg-slate-50/60 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                  >
                    <span>{m.label}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">${m.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className={adminCard}>
            <Link
              href="/admin/finanzas/reembolsos"
              className="text-base font-bold text-[#0585FC] transition hover:text-[#0461C4]"
            >
              Ver panel de reembolsos →
            </Link>
          </section>

          <section className={adminCard}>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Saldo deudor con PadeLibre</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Comisión del 5% sobre turnos cobrados en efectivo o transferencia en el club.
            </p>
            {debtLoadError ? (
              <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">{debtLoadError}</p>
            ) : null}
            <p className="mt-4 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              ${debtTotal.toFixed(2)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Total deuda pendiente</p>
            <ul className="mt-5 flex flex-col gap-2">
              {debtRows.map((row) => {
                const rel = row.matches;
                const m = Array.isArray(rel) ? rel[0] ?? null : rel;
                const d = m?.scheduled_date ?? "";
                const t = (m?.scheduled_time ?? "").toString().trim().slice(0, 5);
                const partidoLabel =
                  d.length >= 10
                    ? `${format(parseISO(`${d}T12:00:00`), "d MMM yyyy", { locale: es })}${t ? ` · ${t}` : ""}`
                    : "—";
                const met = String(row.payment_method ?? "").toLowerCase();
                const metLabel = met === "cash" ? "Efectivo" : met === "transfer" ? "Transferencia" : met || "—";
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100/90 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {format(new Date(row.confirmed_at), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Partido {partidoLabel} · {metLabel}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold text-rose-700 dark:text-rose-300">
                      ${Number(row.amount ?? 0).toFixed(2)}
                    </span>
                  </li>
                );
              })}
              {debtRows.length === 0 && !debtLoadError ? (
                <li className="text-sm font-medium text-slate-500 dark:text-slate-400">Sin deuda pendiente.</li>
              ) : null}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Este saldo corresponde al 5% de reservas cobradas en efectivo o transferencia. Contactá a PadeLibre
              para saldar:{" "}
              <a className="font-semibold text-[#0585FC] hover:underline" href="mailto:soporte.padelibre@gmail.com">
                soporte.padelibre@gmail.com
              </a>
            </p>
          </section>
        </>
      ) : null}

      {loading && rows.length > 0 ? (
        <p className="text-center text-xs font-medium text-slate-400">Actualizando datos…</p>
      ) : null}
    </div>
  );
}
