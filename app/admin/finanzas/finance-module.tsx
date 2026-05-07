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

const PIN = "1234";
const CACHE_PREFIX = "admin_finance_matches_v1:";
const CACHE_TTL_MS = 90_000;

const btnPrimary = `rounded-2xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.25)] ${adminPressable} hover:bg-slate-800 disabled:opacity-60 disabled:hover:scale-100 disabled:active:scale-100`;
const btnSecondary = `rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm ${adminPressable} hover:bg-slate-50/90`;

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
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const courtIdsRef = useRef(courtIds);
  courtIdsRef.current = courtIds;

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
    if (unlocked) void fetchPaid();
  }, [unlocked, fetchPaid]);

  function tryPin(e: FormEvent) {
    e.preventDefault();
    if (pinInput === PIN) {
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
  const byDay = useMemo(() => aggregateByDay(rows, 14), [rows]);
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
  const pendingRows = useMemo(() => {
    const since = subDays(now, 30);
    return rows
      .filter((r) => (r.payment_status ?? "").toLowerCase() === "pending")
      .filter((r) => parseISO(r.date) >= since)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [now, rows]);
  const pendingOwnerIds = Array.from(new Set(pendingRows.map((r) => r.owner_id).filter((v): v is string => Boolean(v))));
  const [ownerNames, setOwnerNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    async function loadOwnerNames() {
      if (pendingOwnerIds.length === 0) {
        setOwnerNames(new Map());
        return;
      }
      const supabase = createClient();
      const { data } = await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", pendingOwnerIds);
      setOwnerNames(new Map((data ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name ?? "Jugador"])));
    }
    void loadOwnerNames();
  }, [pendingOwnerIds.join(",")]);

  if (!unlocked) {
    return (
      <form
        onSubmit={tryPin}
        className={`mx-auto max-w-sm space-y-5 ${adminCard}`}
      >
        <h2 className="text-lg font-bold text-slate-900">Módulo financiero</h2>
        <p className="text-sm font-medium text-slate-500">
          Ingresá el PIN de administrador (4 dígitos) para ver agregados de ingresos.
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pinInput}
          onChange={(e) => {
            setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
            setPinError(false);
          }}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-lg font-semibold tracking-widest outline-none transition-shadow focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
          placeholder="····"
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
        <p className="text-sm font-semibold text-emerald-800">
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
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
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
              <p className="mt-2 text-xl font-bold text-slate-900">${avgTicket.toFixed(2)}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">Por reserva pagada</p>
            </div>
            <div className={adminCard}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cancha más rentable (mes)</p>
              <p className="mt-2 text-base font-bold text-slate-900">
                {topCourtMonth ? `${courtName.get(topCourtMonth[0]) ?? "Cancha"}` : "Sin datos"}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {topCourtMonth ? `$${topCourtMonth[1].toFixed(2)}` : "Sin ingresos del mes"}
              </p>
            </div>
            <div className={adminCard}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pagos pendientes (30 días)</p>
              <p className="mt-2 text-xl font-bold text-amber-700">{pendingRows.length}</p>
            </div>
          </section>

          <section className={adminCard}>
            <h3 className="text-base font-bold text-slate-900">Este mes vs mes anterior</h3>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Mes actual
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900">${compare.current.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Mes anterior
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-700">
                  ${compare.previous.toFixed(2)}
                </p>
              </div>
            </div>
            <p
              className={`mt-4 text-sm font-semibold ${
                compare.deltaPct >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {compare.deltaPct >= 0 ? "↑" : "↓"} {Math.abs(compare.deltaPct).toFixed(1)}% vs periodo
              anterior
            </p>
          </section>

          <section className={adminCard}>
            <h3 className="text-base font-bold text-slate-900">Pagos pendientes</h3>
            {pendingRows.length === 0 ? (
              <p className="mt-3 text-sm font-medium text-slate-500">No hay pendientes en los últimos 30 días.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {pendingRows.slice(0, 20).map((row) => {
                  const dateYmd = row.scheduled_date ?? format(parseISO(row.date), "yyyy-MM-dd");
                  return (
                    <li key={row.id} className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-3 text-sm md:flex-row md:items-center md:justify-between">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-900">{ownerNames.get(row.owner_id ?? "") ?? "Jugador"}</p>
                        <p className="text-xs text-slate-500">
                          {format(parseISO(`${dateYmd}T12:00:00`), "d MMM yyyy", { locale: es })} · {courtName.get(row.court_id) ?? "Cancha"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-amber-700">${Number(row.total_price ?? 0).toFixed(2)}</p>
                        <Link href={`/admin/reservas?date=${dateYmd}`} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          Ver detalle
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={adminCard}>
            <h3 className="text-base font-bold text-slate-900">Por cancha</h3>
            <ul className="mt-5 flex flex-col gap-2">
              {Array.from(byCourt.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([id, amount]) => (
                  <li
                    key={id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100/90 bg-slate-50/40 px-4 py-3 text-sm font-medium ring-1 ring-slate-100/60"
                  >
                    <span>{courtName.get(id) ?? id}</span>
                    <span className="font-bold text-slate-900">${amount.toFixed(2)}</span>
                  </li>
                ))}
              {byCourt.size === 0 ? (
                <li className="text-sm font-medium text-slate-500">Sin pagos registrados.</li>
              ) : null}
            </ul>
          </section>

          <section className="flex flex-col gap-4 lg:grid lg:grid-cols-3">
            <div className={adminCard}>
              <h4 className="text-sm font-bold text-slate-900">Por día</h4>
              <div className="mt-4 flex flex-col gap-3">
                {byDay.map((d) => (
                  <div key={d.key} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-500">
                      <span>{d.label}</span>
                      <span>${d.total.toFixed(2)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/40">
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
              <h4 className="text-sm font-bold text-slate-900">Por semana</h4>
              <ul className="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-600">
                {byWeek.map((w) => (
                  <li
                    key={w.key}
                    className="flex justify-between rounded-xl border border-transparent px-1 py-1.5 hover:border-slate-100 hover:bg-slate-50/60"
                  >
                    <span>{w.key}</span>
                    <span className="font-semibold text-slate-800">${w.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={adminCard}>
              <h4 className="text-sm font-bold text-slate-900">Por mes</h4>
              <ul className="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-600">
                {byMonth.map((m) => (
                  <li
                    key={m.key}
                    className="flex justify-between rounded-xl border border-transparent px-1 py-1.5 hover:border-slate-100 hover:bg-slate-50/60"
                  >
                    <span>{m.label}</span>
                    <span className="font-semibold text-slate-800">${m.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      ) : null}

      {loading && rows.length > 0 ? (
        <p className="text-center text-xs font-medium text-slate-400">Actualizando datos…</p>
      ) : null}
    </div>
  );
}
