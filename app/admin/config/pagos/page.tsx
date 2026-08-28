import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import AdminFlashMessage from "@/components/admin/admin-flash-message";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { adminAccentBar, adminCard, adminKicker, adminPressable } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import ConfigPaymentMethodsForm from "../config-payment-methods-form";

export const dynamic = "force-dynamic";

const NO_CLUB_MSG = "No tenés un club asignado. Contactá a soporte.padelibre@gmail.com";

function flash(ok: boolean, err: string) {
  if (ok) return <AdminFlashMessage type="success" message="Cambios guardados correctamente." />;
  if (err) return <AdminFlashMessage type="error" message={err} />;
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
        <AdminPageHeader kicker="Configuración" title="Métodos de pago" />
        <div className={`${adminCard} p-6 text-sm font-medium text-amber-800`}>{NO_CLUB_MSG}</div>
      </div>
    );
  }

  const clubId = ctx.clubIds[0];
  // mp_access_token/mp_user_id estan revocadas para anon/authenticated: se leen con service client.
  const { data: clubRaw, error: clubErr } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .select("mp_access_token,mp_user_id,mp_email,accepts_cash,accepts_transfer,bank_alias,bank_cbu")
    .eq("id", clubId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();

  if (clubErr || !clubRaw) {
    return (
      <div className="flex flex-col gap-6">
        <AdminBackLink href="/admin/config" label="Volver a Configuración" />
        <AdminPageHeader kicker="Configuración" title="Métodos de pago" />
        <div className={`${adminCard} p-6 text-sm font-medium text-rose-700`}>
          {clubErr?.message ?? "No se pudo cargar el club."}
        </div>
      </div>
    );
  }

  const club = clubRaw as {
    mp_access_token: string | null;
    mp_user_id: string | null;
    mp_email: string | null;
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
      <AdminPageHeader
        kicker="Configuración"
        title="Métodos de pago"
        subtitle="Configurá cómo recibís los pagos de tus jugadores"
      />

      <section className={`${adminCard} ${adminAccentBar} p-6`}>
        {flash(paymentsOk, paymentsErr)}
        <div className="mt-4">
          <ConfigPaymentMethodsForm
            isMpConnected={isMpConnected}
            mpUserId={club.mp_user_id}
            mpEmail={club.mp_email}
            initial={{
              accepts_cash: Boolean(club.accepts_cash),
              accepts_transfer: Boolean(club.accepts_transfer),
              bank_alias: club.bank_alias ?? "",
              bank_cbu: club.bank_cbu ?? "",
            }}
          />
        </div>
      </section>

      <Link
        href="/admin/config/mp-connect"
        className={`${adminCard} ${adminPressable} flex items-center justify-between gap-4`}
      >
        <div>
          <p className={adminKicker}>Mercado Pago</p>
          <p className="font-bold text-[var(--text-primary)] mt-1">
            Conectar Mercado Pago
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Conectá tu cuenta de MP para recibir pagos online de reservas y torneos.
          </p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-[var(--text-tertiary)]" />
      </Link>
    </div>
  );
}
