import Link from "next/link";

const tournaments = [
  {
    title: "Torneo Primavera 2025",
    club: "Padel Club Centro",
    date: "Sab 12 Abr",
    level: "Intermedio",
    price: "$5.000",
    pairs: "12/16 parejas",
    status: "Inscripcion abierta",
  },
  {
    title: "Liga Nocturna",
    club: "Arena Padel",
    date: "Todos los viernes",
    level: "Todos",
    price: "$3.500",
    pairs: "8/8 parejas",
    status: "Completo",
  },
  {
    title: "Copa Principiantes",
    club: "Top Padel Sports",
    date: "Dom 20 Abr",
    level: "Principiante",
    price: "$4.000",
    pairs: "6/12 parejas",
    status: "Inscripcion abierta",
  },
];

export default function PartidosPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-slate-50 px-4 pb-24 pt-6">
      <p className="text-sm font-medium text-sky-500">Inicio</p>
      <h1 className="text-2xl font-bold text-slate-900">Competir</h1>
      <p className="text-sm text-slate-500">Torneos y competencias de padel</p>

      <section className="space-y-3">
        {tournaments.map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
                <p className="text-sm text-slate-500">{item.club}</p>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                {item.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {item.date} - {item.level}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-3xl font-bold text-sky-500">{item.price}</p>
              <Link
                href="/reservas"
                className="rounded-2xl px-3 py-2 text-sm font-semibold text-sky-500 transition hover:opacity-95"
              >
                Ver
              </Link>
            </div>
            <p className="mt-1 text-sm text-slate-500">{item.pairs}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
