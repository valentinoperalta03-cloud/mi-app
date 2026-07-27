import { redirect } from "next/navigation";
import {
  adminAccentBar,
  adminBadgeLima,
  adminCard,
  adminCTAPrimary,
  adminKicker,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import ActivateSubscriptionButton from "./activate-subscription-button";

const REASON_MESSAGES: Record<string, string> = {
  pending:
    "Para empezar a usar PadeLibre necesitás cargar una tarjeta con débito automático. No se te cobra nada durante los primeros 15 días.",
  trial_expired:
    "Tu período de prueba de 15 días finalizó. Para seguir usando PadeLibre, activá tu suscripción.",
  past_due: "Tu pago mensual no pudo procesarse. Actualizá tu método de pago para continuar.",
  paused: "Tu suscripción está pausada. Reactivala para volver a usar el panel.",
};

function formatDateAr(value: string | null): string {
  if (!value) return "sin definir";
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const clubId = ctx.clubIds[0] ?? "";
  if (!clubId) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10 text-center">
        <p className="text-sm font-medium text-rose-600">
          No encontramos un club asociado a tu cuenta. Contactá a soporte.
        </p>
      </div>
    );
  }

  // subscription_status/trial_end_date/next_billing_date estan revocadas para
  // authenticated, por eso esta consulta usa el service client.
  const service = createServiceClient();
  const { data: clubRow } = await service
    .from(DB_TABLES.clubs)
    .select("subscription_status, trial_end_date, next_billing_date")
    .eq("id", clubId)
    .maybeSingle();
  const row = clubRow as {
    subscription_status?: string | null;
    trial_end_date?: string | null;
    next_billing_date?: string | null;
  } | null;
  const status = row?.subscription_status ?? "trial";

  if (status === "active") {
    const nextBillingDate = row?.next_billing_date ?? null;
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10 text-center">
        <div className={`${adminCard} ${adminAccentBar} w-full max-w-lg`}>
          <p className={`${adminKicker} text-emerald-600`}>Suscripción PadeLibre</p>
          <h1 className={`${adminTitle} mt-2`}>Tu suscripción está activa</h1>
          <p className={`${adminSubtitle} mt-3`}>
            {nextBillingDate
              ? `Próximo cobro: ${formatDateAr(nextBillingDate)}.`
              : "Todavía no tenemos la fecha de tu próximo cobro."}
          </p>

          <div className={`mt-6 ${adminBadgeLima}`}>
            ✓ Activa
          </div>

          <p className="mt-6 text-sm font-medium text-[var(--text-secondary)]">
            Para actualizar tu medio de pago o cancelar la suscripción, gestionala directamente desde Mercado Pago.
          </p>
          <a
            href="https://www.mercadopago.com.ar/subscriptions"
            target="_blank"
            rel="noreferrer"
            className={`mt-4 inline-flex w-full items-center justify-center text-sm ${adminCTAPrimary}`}
          >
            Gestionar en Mercado Pago
          </a>
        </div>
      </div>
    );
  }

  if (status === "trial") {
    const daysLeft = row?.trial_end_date
      ? Math.max(Math.ceil((new Date(row.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)), 0)
      : null;
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10 text-center">
        <div className={`${adminCard} ${adminAccentBar} w-full max-w-lg`}>
          <p className={`${adminKicker} text-[#0085FC]`}>Suscripción PadeLibre</p>
          <h1 className={`${adminTitle} mt-2`}>Estás en período de prueba</h1>
          <p className={`${adminSubtitle} mt-3`}>
            {daysLeft != null
              ? `Te ${daysLeft === 1 ? "queda" : "quedan"} ${daysLeft} día${daysLeft === 1 ? "" : "s"} de prueba gratuita.`
              : "Estás en período de prueba gratuita."}
          </p>

          <div className="mt-6 rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/5 p-5">
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              $50.000 <span className="text-base font-medium text-[var(--text-tertiary)]">ARS/mes</span>
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
              Sin comisiones por uso. Sin letra chica.
            </p>
          </div>

          <ActivateSubscriptionButton clubId={clubId} />
        </div>
      </div>
    );
  }

  const sp = (await searchParams) ?? {};
  const reason = sp.reason ?? "";
  const message =
    REASON_MESSAGES[reason] ?? REASON_MESSAGES[status] ?? "Activá tu suscripción para seguir usando el panel de PadeLibre.";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10 text-center">
      <div className={`${adminCard} ${adminAccentBar} w-full max-w-lg`}>
        <p className={`${adminKicker} text-[#0085FC]`}>Suscripción PadeLibre</p>
        <h1 className={`${adminTitle} mt-2`}>Activá tu suscripción</h1>
        <p className={`${adminSubtitle} mt-3`}>{message}</p>

        <div className="mt-6 rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/5 p-5">
          <p className="text-3xl font-bold text-[var(--text-primary)]">
            $50.000 <span className="text-base font-medium text-[var(--text-tertiary)]">ARS/mes</span>
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
            Sin comisiones por uso. Sin letra chica.
          </p>
        </div>

        <ActivateSubscriptionButton clubId={clubId} />
      </div>
    </div>
  );
}
