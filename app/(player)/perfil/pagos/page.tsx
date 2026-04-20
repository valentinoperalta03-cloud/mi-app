import Link from "next/link";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

function statusBadgeClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "approved" || normalized === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized === "pending" || normalized === "in_process") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export default async function PerfilPagosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from(DB_TABLES.payments)
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-1 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-4 text-white">
        <p className="text-xs uppercase tracking-widest text-sky-100">Perfil</p>
        <h1 className="text-2xl font-bold leading-tight tracking-tight">Tus pagos</h1>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold text-slate-900">Últimas transacciones</h2>
        <div className="mt-3 space-y-2">
          {(rows ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">Todavía no tenés transacciones registradas.</p>
          ) : (
            (rows ?? []).map((row) => {
              const typed = row as {
                id: string;
                created_at: string | null;
                amount: number | null;
                status: string | null;
              };
              const date = typed.created_at ? new Date(typed.created_at) : null;
              return (
                <article key={typed.id} className="rounded-2xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-slate-900">
                      {date ? date.toLocaleDateString("es-AR") : "Sin fecha"}
                    </p>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClass(
                        typed.status ?? "rejected"
                      )}`}
                    >
                      {(typed.status ?? "desconocido").toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    Monto: {money.format(Number(typed.amount ?? 0))}
                  </p>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-bold text-slate-900">Métodos de pago</h2>
        <p className="mt-2 text-sm text-slate-600">Los pagos se procesan de forma segura mediante Mercado Pago</p>
        <Link
          href="https://www.mercadopago.com.ar"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-full justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Ir a Mercado Pago
        </Link>
      </section>
    </main>
  );
}
