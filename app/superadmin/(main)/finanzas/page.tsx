import Link from "next/link";
import { format } from "date-fns";
import { moneyArs, SUBSCRIPTION_PRICE_ARS, type SuperadminClubOverview } from "@/lib/superadmin/club-overview";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

export default async function SuperadminFinanzasPage() {
  const { svc } = await requireSuperadminAction();
  const { data: overviewRaw } = await svc.from("superadmin_clubs_overview").select("*");
  const overview = (overviewRaw ?? []) as SuperadminClubOverview[];

  const activos = overview.filter((r) => r.subscription_status === "active");
  const enTrial = overview.filter((r) => r.subscription_status === "pending" || r.subscription_status === "trial");
  const conProblemas = overview.filter((r) => r.subscription_status === "past_due" || r.subscription_status === "paused");

  const mrrActual = activos.length * SUBSCRIPTION_PRICE_ARS;
  const mrrPotencial = (activos.length + enTrial.length) * SUBSCRIPTION_PRICE_ARS;

  const in7Days = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const proximosCobros = overview
    .filter((r) => r.next_billing_date && new Date(r.next_billing_date) <= in7Days)
    .sort((a, b) => new Date(a.next_billing_date ?? 0).getTime() - new Date(b.next_billing_date ?? 0).getTime());

  const pagosFallidos = overview
    .filter((r) => r.subscription_status === "past_due")
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold text-white">Finanzas globales</h1>
        <p className="mt-1 text-sm text-slate-400">
          Modelo B2B: suscripción mensual fija de {moneyArs(SUBSCRIPTION_PRICE_ARS)} por club. Sin comisión por
          transacción.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/80">MRR actual</p>
          <p className="mt-2 text-3xl font-bold text-white">{moneyArs(mrrActual)}</p>
          <p className="mt-1 text-sm text-slate-400">
            {activos.length} club{activos.length === 1 ? "" : "es"} activo{activos.length === 1 ? "" : "s"} ×{" "}
            {moneyArs(SUBSCRIPTION_PRICE_ARS)}
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 to-slate-900/60 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300/80">MRR potencial</p>
          <p className="mt-2 text-3xl font-bold text-white">{moneyArs(mrrPotencial)}</p>
          <p className="mt-1 text-sm text-slate-400">
            ({activos.length} activos + {enTrial.length} en trial) × {moneyArs(SUBSCRIPTION_PRICE_ARS)}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Por estado</h2>
        <ul className="mt-4 space-y-2">
          <li className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-4 py-3">
            <span className="text-sm text-emerald-100">Activos: {activos.length} clubes</span>
            <span className="text-sm font-semibold text-white">{moneyArs(activos.length * SUBSCRIPTION_PRICE_ARS)}/mes garantizados</span>
          </li>
          <li className="flex items-center justify-between rounded-xl border border-sky-500/20 bg-sky-950/30 px-4 py-3">
            <span className="text-sm text-sky-100">En trial: {enTrial.length} clubes</span>
            <span className="text-sm font-semibold text-white">{moneyArs(enTrial.length * SUBSCRIPTION_PRICE_ARS)} potenciales</span>
          </li>
          <li className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-950/30 px-4 py-3">
            <span className="text-sm text-rose-100">Con problemas: {conProblemas.length} clubes</span>
            <span className="text-sm font-semibold text-white">{moneyArs(conProblemas.length * SUBSCRIPTION_PRICE_ARS)} en riesgo</span>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Próximos cobros (7 días)</h2>
        <ul className="mt-4 space-y-2">
          {proximosCobros.length === 0 ? (
            <li className="text-sm text-slate-500">Sin cobros programados esta semana.</li>
          ) : (
            proximosCobros.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2">
                <Link href={`/superadmin/clubes/${c.id}`} className="text-sm text-slate-200 underline-offset-2 hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-slate-400">
                  {c.next_billing_date ? format(new Date(c.next_billing_date), "dd/MM/yyyy") : "—"}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Pagos fallidos</h2>
        <ul className="mt-4 space-y-2">
          {pagosFallidos.length === 0 ? (
            <li className="text-sm text-slate-500">Ningún club en past_due.</li>
          ) : (
            pagosFallidos.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-950/30 px-3 py-2">
                <Link href={`/superadmin/clubes/${c.id}`} className="text-sm text-rose-100 underline-offset-2 hover:underline">
                  {c.name}
                </Link>
                <span className="text-xs text-rose-300">
                  Próximo intento: {c.next_billing_date ? format(new Date(c.next_billing_date), "dd/MM/yyyy") : "—"}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
