import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminCTAPrimary, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { updateFinancePin } from "./actions";
import FinanceModule from "./finance-module";

function flash(ok: boolean, err: string) {
  if (ok) {
    return (
      <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
        Cambios guardados correctamente.
      </p>
    );
  }
  if (err) {
    return (
      <p className="mt-4 rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
        {err}
      </p>
    );
  }
  return null;
}

type PageProps = {
  searchParams?: Promise<{ pin_saved?: string; pin_error?: string }>;
};

/** DB: indice en matches(court_id) y, si filtras por fecha, (court_id, date) acelera esta vista. */
export default async function AdminFinanzasPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const clubId = ctx.clubIds[0];
  const { data: clubRow } = clubId
    ? await supabase
        .from(DB_TABLES.clubs)
        .select("finance_pin")
        .eq("id", clubId)
        .eq("owner_id", ctx.userId)
        .maybeSingle()
    : { data: null };
  const hasFinancePin = Boolean(String((clubRow as { finance_pin?: string | null } | null)?.finance_pin ?? "").trim());

  const decode = (key?: string) => (key ? decodeURIComponent(key) : "");
  const pinOk = sp.pin_saved === "1";
  const pinErr = decode(sp.pin_error);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-emerald-600`}>Finanzas</p>
        <h1 className={adminTitle}>Reportes e ingresos</h1>
        <p className={adminSubtitle}>Ingresos calculados sobre los turnos ya cobrados.</p>
      </header>
      <Link
        href="/admin/finanzas/reembolsos"
        className="inline-flex w-fit rounded-2xl border border-emerald-200 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
      >
        Reembolsos
      </Link>
      <FinanceModule courtIds={ctx.courtIds} courts={ctx.courts} />

      <section className={`${adminCard} p-6`}>
        <h2 className="font-admin-display flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
          <Lock size={18} />
          PIN de finanzas
        </h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          {hasFinancePin
            ? "Protegé el módulo financiero con un PIN de 4 a 6 dígitos."
            : "Creá un PIN de 4 a 6 dígitos para acceder a finanzas."}
        </p>
        {flash(pinOk, pinErr)}
        <form action={updateFinancePin} className="mt-4 grid gap-3 sm:grid-cols-2">
          {hasFinancePin ? (
            <label className="sm:col-span-2">
              <span className={adminKicker}>PIN actual</span>
              <input
                name="current_pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{4,6}"
                required
                className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          <label>
            <span className={adminKicker}>
              {hasFinancePin ? "Nuevo PIN" : "PIN"}
            </span>
            <input
              name="new_pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{4,6}"
              required
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className={adminKicker}>Confirmar PIN</span>
            <input
              name="confirm_pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{4,6}"
              required
              className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={adminCTAPrimary}>
              {hasFinancePin ? "Cambiar PIN" : "Crear PIN"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
