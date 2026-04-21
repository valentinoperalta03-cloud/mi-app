import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminPressable, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";

function mpRedirectUri(): string {
  const explicit = process.env.MP_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api/mp/callback`;
}

function buildMercadoPagoAuthUrl(clubId: string): string | null {
  const clientId = process.env.MP_APP_ID?.trim();
  if (!clientId) return null;
  const redirectUri = mpRedirectUri();
  const u = new URL("https://auth.mercadopago.com.ar/authorization");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("platform_id", "mp");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", clubId);
  return u.toString();
}

export default async function MercadoPagoConnectPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  if (ctx.clubIds.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <AdminBackLink />
        <p className={adminKicker}>Mercado Pago</p>
        <h1 className={adminTitle}>Conectar cobros</h1>
        <p className={adminSubtitle}>No tenés ningún club asignado como dueño.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={adminKicker}>Mercado Pago</p>
        <h1 className={adminTitle}>Conectar con Mercado Pago</h1>
        <p className={adminSubtitle}>
          Vinculá tu cuenta de Mercado Pago del club para recibir pagos con comisión automática a Padelibre.
        </p>
      </header>

      <section className={`${adminCard} space-y-4`}>
        <p className="text-sm font-medium text-slate-600">
          Elegí el club y hacé clic. Serás redirigido a Mercado Pago para autorizar la aplicación. La URL de retorno
          configurada es <code className="text-xs text-slate-500">{mpRedirectUri()}</code>.
        </p>
        <ul className="flex flex-col gap-3">
          {ctx.clubs.map((club) => {
            const href = buildMercadoPagoAuthUrl(club.id);
            return (
              <li key={club.id}>
                {href ? (
                  <a
                    href={href}
                    className={`inline-flex w-full items-center justify-center rounded-2xl bg-[#0461C4] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#0585FC]/50 ${adminPressable}`}
                  >
                    Conectar con Mercado Pago — {club.name ?? "Club"}
                  </a>
                ) : (
                  <p className="text-sm text-rose-700">
                    Falta la variable <code className="text-xs">MP_APP_ID</code> en el entorno.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <Link href="/admin/config" className="text-sm font-semibold text-[#0585FC] hover:text-[#0585FC]">
          Volver a configuración
        </Link>
      </section>
    </div>
  );
}
