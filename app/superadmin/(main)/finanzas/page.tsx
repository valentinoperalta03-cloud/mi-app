import { requireSuperadminAction } from "@/lib/superadmin/guards";

export default async function SuperadminFinanzasPage() {
  await requireSuperadminAction();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold text-white">Finanzas globales</h1>
      </header>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <p className="text-sm text-slate-300">
          El modelo de comisiones por transacción fue discontinuado. PadeLibre opera con suscripción mensual fija de
          $50.000 ARS por club. Los saldos históricos de <code className="text-slate-400">club_debts</code> están
          disponibles directamente en Supabase.
        </p>
      </section>
    </div>
  );
}
