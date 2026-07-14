import { redirect } from "next/navigation";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { createServiceClient } from "@/utils/supabase/server";

type PreApprovalResponse = {
  id?: string;
  status?: string;
  external_reference?: string;
  next_payment_date?: string;
  auto_recurring?: { start_date?: string };
};

export default async function FacturacionCallbackPage({
  searchParams,
}: {
  searchParams?: Promise<{ preapproval_id?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const preapprovalId = String(sp.preapproval_id ?? "").trim();

  if (!preapprovalId) {
    redirect("/admin/facturacion?reason=past_due");
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  let preapproval: PreApprovalResponse | null = null;
  try {
    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.ok) {
      preapproval = (await res.json()) as PreApprovalResponse;
    }
  } catch (e) {
    log.error({ event: "mp.subscription.callback.fetch_failed", preapprovalId, err: e });
  }

  if (!preapproval) {
    redirect("/admin/facturacion?reason=past_due");
  }

  const status = String(preapproval.status ?? "").toLowerCase();

  if (status === "authorized") {
    const clubId = String(preapproval.external_reference ?? "").trim();
    const nextBillingDate = preapproval.next_payment_date ?? preapproval.auto_recurring?.start_date ?? null;

    const service = createServiceClient();
    const patch = {
      subscription_status: "active",
      mp_subscription_id: preapprovalId,
      next_billing_date: nextBillingDate,
    };
    const { error } = clubId
      ? await service.from(DB_TABLES.clubs).update(patch).eq("id", clubId)
      : await service.from(DB_TABLES.clubs).update(patch).eq("mp_subscription_id", preapprovalId);

    if (error) {
      log.error({ event: "mp.subscription.callback.update_failed", preapprovalId, err: error });
      redirect("/admin/facturacion?reason=past_due");
    }

    redirect("/admin/dashboard?subscription=activated");
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10 text-center">
      <div className={`${adminCard} w-full max-w-lg`}>
        <p className={`${adminKicker} text-[#0585FC]`}>Suscripción PadeLibre</p>
        <h1 className={`${adminTitle} mt-2`}>Procesando tu suscripción</h1>
        <p className={`${adminSubtitle} mt-3`}>
          Tu suscripción está siendo procesada. En unos minutos vas a recibir confirmación.
        </p>
      </div>
    </div>
  );
}
