import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminAccentBar, adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import ConfigPaymentMethodsForm from "../config-payment-methods-form";

export const dynamic = "force-dynamic";

const NO_CLUB_MSG = "No tenés un club asignado. Contactá a soporte.padelibre@gmail.com";

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
  searchParams?: Promise<{ payments_saved?: string; payments_error?: string }>;
};

export default async function AdminConfigPagosPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  if (!ctx.clubIds.length) {
    return (
      <div className="flex flex-col gap-6">
        <AdminBackLink href="/admin/config" label="Volver a Configuración" />
        <header className="space-y-2">
          <p className={adminKicker}>Configuración</p>
          <h1 className={adminTitle}>Métodos de pago</h1>
        </header>
        <div className={`${adminCard} p-6 text-sm font-medium text-amber-800`}>{NO_CLUB_MSG}</div>
      </div>
    );
  }

  const clubId = ctx.clubIds[0];
  // mp_access_token/mp_user_id estan revocadas para anon/authenticated: se leen con service client.
  const { data: clubRaw, error: clubErr } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .select("mp_access_token,mp_user_id,accepts_cash,accepts_transfer,bank_alias,bank_cbu")
    .eq("id", clubId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();

  if (clubErr || !clubRaw) {
    return (
      <div className="flex flex-col gap-6">
        <AdminBackLink href="/admin/config" label="Volver a Configuración" />
        <header className="space-y-2">
          <p className={adminKicker}>Configuración</p>
          <h1 className={adminTitle}>Métodos de pago</h1>
        </header>
        <div className={`${adminCard} p-6 text-sm font-medium text-rose-700`}>
          {clubErr?.message ?? "No se pudo cargar el club."}
        </div>
      </div>
    );
  }

  const club = clubRaw as {
    mp_access_token: string | null;
    mp_user_id: string | null;
    accepts_cash: boolean | null;
    accepts_transfer: boolean | null;
    bank_alias: string | null;
    bank_cbu: string | null;
  };

  const isMpConnected = Boolean(club.mp_access_token);
  const decode = (key?: string) => (key ? decodeURIComponent(key) : "");
  const paymentsOk = sp.payments_saved === "1";
  const paymentsErr = decode(sp.payments_error);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/config" label="Volver a Configuración" />
      <header className="space-y-2">
        <p className={adminKicker}>Configuración</p>
        <h1 className={adminTitle}>Métodos de pago</h1>
        <p className={adminSubtitle}>Mercado Pago, efectivo y transferencia bancaria.</p>
      </header>

      <section className={`${adminCard} ${adminAccentBar} p-6`}>
        {flash(paymentsOk, paymentsErr)}
        <div className="mt-4">
          <ConfigPaymentMethodsForm
            isMpConnected={isMpConnected}
            mpUserId={club.mp_user_id}
            initial={{
              accepts_cash: Boolean(club.accepts_cash),
              accepts_transfer: Boolean(club.accepts_transfer),
              bank_alias: club.bank_alias ?? "",
              bank_cbu: club.bank_cbu ?? "",
            }}
          />
        </div>
      </section>
    </div>
  );
}
