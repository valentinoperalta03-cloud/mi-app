import Link from "next/link";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminAccentBar, adminBadgeError, adminCard, adminCTAPrimary, adminEmptyState, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

type MatchEmbed = { id: string; court_id: string; scheduled_date: string | null };

type PaymentRefundRow = {
  id: string;
  user_id: string;
  amount: number | null;
  status: string | null;
  matches: MatchEmbed[] | null;
};

export default async function AdminReembolsosPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const monthParam = /^\d{4}-\d{2}$/.test(String(sp.month ?? "")) ? String(sp.month) : format(new Date(), "yyyy-MM");
  const monthStart = startOfMonth(new Date(`${monthParam}-01T00:00:00`));
  const monthEnd = endOfMonth(monthStart);

  const { data: payments } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.payments)
          .select("id,user_id,amount,status,matches!inner(id,court_id,scheduled_date)")
          .in("matches.court_id", ctx.courtIds)
          .in("status", ["refunded", "cancelled"])
          .gte("matches.scheduled_date", format(monthStart, "yyyy-MM-dd"))
          .lte("matches.scheduled_date", format(monthEnd, "yyyy-MM-dd"))
          .order("created_at", { ascending: false })
      : { data: [] };

  const rows: PaymentRefundRow[] = ((payments ?? []) as unknown[]).map((raw) => {
    const r = raw as {
      id: string;
      user_id: string;
      amount: number | null;
      status: string | null;
      matches: MatchEmbed[] | null;
    };
    return {
      id: r.id,
      user_id: r.user_id,
      amount: r.amount,
      status: r.status,
      matches: r.matches,
    };
  });

  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", userIds)
    : { data: [] };
  const nameByUser = new Map((profiles ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name ?? "Jugador"]));
  const courtNameById = new Map(ctx.courts.map((c) => [c.id, c.name ?? "Cancha"]));

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/finanzas" />
      <header className="space-y-2">
        <p className={`${adminKicker} text-emerald-600`}>Reembolsos</p>
        <h1 className={adminTitle}>Panel de reembolsos</h1>
        <p className={adminSubtitle}>Pagos cancelados o reembolsados del período.</p>
      </header>

      <form className={`${adminCard} flex items-end gap-3`}>
        <label className="flex-1 space-y-1">
          <span className={adminKicker}>Mes</span>
          <input type="month" name="month" defaultValue={monthParam} className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)]" />
        </label>
        <button type="submit" className={adminCTAPrimary}>
          Filtrar
        </button>
      </form>

      <section className={`${adminCard} ${adminAccentBar}`}>
        {rows.length === 0 ? (
          <p className={adminEmptyState}>No hay reembolsos para este mes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/70 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--text-secondary)]">{nameByUser.get(row.user_id) ?? "Jugador"}</span>
                  <span className={adminBadgeError}>{row.status ?? "—"}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {courtNameById.get(row.matches?.[0]?.court_id ?? "") ?? "Cancha"} · {row.matches?.[0]?.scheduled_date ?? "Sin fecha"} · ${Number(row.amount ?? 0).toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/admin/reservas" className="text-sm font-semibold text-[#0585FC]">
        Ir a reservas para solicitar reembolsos
      </Link>
    </div>
  );
}
