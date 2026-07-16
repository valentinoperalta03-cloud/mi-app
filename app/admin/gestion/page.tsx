import Link from "next/link";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminCTAPrimary, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <AdminBackLink />
      <div className={adminCard}>
        <h1 className={adminTitle}>Esta sección fue movida</h1>
        <p className={`mt-2 ${adminSubtitle}`}>
          La gestión de reservas y canchas ahora vive en otras secciones del panel.
        </p>
        <Link
          href="/admin/reservas"
          className={`mt-4 inline-flex w-fit items-center text-sm ${adminCTAPrimary}`}
        >
          Ir a Reservas
        </Link>
      </div>
    </div>
  );
}
