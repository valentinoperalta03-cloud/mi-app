import Link from "next/link";

const links = [
  { href: "/admin/gestion", label: "Gestión del club", description: "Canchas, horarios y datos" },
  { href: "/admin/canchas", label: "Canchas", description: "Estado y configuración" },
  { href: "/admin/ingresos", label: "Ingresos", description: "Resumen financiero" },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-sky-600">Panel del club</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Resumen</h2>
        <p className="mt-2 text-sm text-slate-600">
          Elegí una sección para administrar tu club.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
            >
              <span className="font-semibold text-slate-900">{item.label}</span>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
