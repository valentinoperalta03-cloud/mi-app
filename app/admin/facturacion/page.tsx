import { redirect } from "next/navigation";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";
import ActivateSubscriptionButton from "./activate-subscription-button";

const REASON_MESSAGES: Record<string, string> = {
  trial_expired:
    "Tu período de prueba de 15 días finalizó. Para seguir usando PadeLibre, activá tu suscripción.",
  past_due: "Tu pago mensual no pudo procesarse. Actualizá tu método de pago para continuar.",
  paused: "Tu suscripción está pausada. Reactivala para volver a usar el panel.",
};

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const sp = (await searchParams) ?? {};
  const reason = sp.reason ?? "";
  const message =
    REASON_MESSAGES[reason] ?? "Activá tu suscripción para seguir usando el panel de PadeLibre.";
  const clubId = ctx.clubIds[0] ?? "";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10 text-center">
      <div className={`${adminCard} w-full max-w-lg`}>
        <p className={`${adminKicker} text-[#0585FC]`}>Suscripción PadeLibre</p>
        <h1 className={`${adminTitle} mt-2`}>Activá tu suscripción</h1>
        <p className={`${adminSubtitle} mt-3`}>{message}</p>

        <div className="mt-6 rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 p-5">
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            $50.000 <span className="text-base font-medium text-slate-500 dark:text-slate-400">ARS/mes</span>
          </p>
          <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
            Sin comisiones por uso. Sin letra chica.
          </p>
        </div>

        {clubId ? (
          <ActivateSubscriptionButton clubId={clubId} />
        ) : (
          <p className="mt-6 text-sm font-medium text-rose-600">
            No encontramos un club asociado a tu cuenta. Contactá a soporte.
          </p>
        )}
      </div>
    </div>
  );
}
