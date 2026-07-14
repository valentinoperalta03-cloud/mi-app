import { endOfMonth, format, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { es } from "date-fns/locale";

export type MatchMoneyRow = {
  id: string;
  date: string;
  court_id: string;
  total_price: number | null;
  amount_paid: number | null;
  payment_status: string | null;
};

const PAID = "paid";

export function filterPaid(rows: MatchMoneyRow[]) {
  return rows.filter((r) => (r.payment_status ?? "").toLowerCase() === PAID);
}

export function sumByCourt(rows: MatchMoneyRow[]) {
  const paid = filterPaid(rows);
  const map = new Map<string, number>();
  for (const r of paid) {
    const p = Number(r.amount_paid ?? 0);
    map.set(r.court_id, (map.get(r.court_id) ?? 0) + p);
  }
  return map;
}

/** Ingreso real ya cobrado (amount_paid), no el precio total del turno: bajo el modelo de senas puede quedar saldo pendiente sin cobrar todavia. */
export function totalPaid(rows: MatchMoneyRow[]) {
  return filterPaid(rows).reduce((s, r) => s + Number(r.amount_paid ?? 0), 0);
}

export function sumInRange(rows: MatchMoneyRow[], from: Date, to: Date) {
  return filterPaid(rows)
    .filter((r) => {
      const d = parseISO(r.date);
      return d >= from && d <= to;
    })
    .reduce((s, r) => s + Number(r.amount_paid ?? 0), 0);
}

export function compareThisMonthVsPrevious(rows: MatchMoneyRow[]) {
  const now = new Date();
  const thisStart = startOfMonth(now);
  const thisEnd = endOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));
  const current = sumInRange(rows, thisStart, thisEnd);
  const previous = sumInRange(rows, prevStart, prevEnd);
  const delta = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  return { current, previous, deltaPct: delta };
}

export function aggregateByDay(rows: MatchMoneyRow[], daysBack = 14) {
  const paid = filterPaid(rows);
  const now = new Date();
  const map = new Map<string, number>();
  for (const r of paid) {
    const d = parseISO(r.date);
    if (d > now) continue;
    const key = format(d, "yyyy-MM-dd");
    map.set(key, (map.get(key) ?? 0) + Number(r.amount_paid ?? 0));
  }
  const keys = Array.from(map.keys())
    .sort()
    .slice(-daysBack);
  return keys.map((k) => ({ key: k, label: format(parseISO(`${k}T12:00:00`), "EEE d MMM", { locale: es }), total: map.get(k) ?? 0 }));
}

export function aggregateByWeek(rows: MatchMoneyRow[]) {
  const paid = filterPaid(rows);
  const map = new Map<string, number>();
  for (const r of paid) {
    const d = parseISO(r.date);
    const wk = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-'W'II");
    map.set(wk, (map.get(wk) ?? 0) + Number(r.amount_paid ?? 0));
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([k, total]) => ({ key: k, total }));
}

export function aggregateByMonth(rows: MatchMoneyRow[]) {
  const paid = filterPaid(rows);
  const map = new Map<string, number>();
  for (const r of paid) {
    const d = parseISO(r.date);
    const mk = format(d, "yyyy-MM");
    map.set(mk, (map.get(mk) ?? 0) + Number(r.amount_paid ?? 0));
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, total]) => ({
      key: k,
      label: format(parseISO(`${k}-01T12:00:00`), "MMM yyyy", { locale: es }),
      total,
    }));
}
