import BottomNav from "@/components/bottom-nav";

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
    <main className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-[hsl(var(--background))] px-4 pb-24 pt-6">
      <p className="text-sm font-medium text-blue-600">Inicio</p>
      <h1 className="text-2xl font-bold text-slate-900">Competir</h1>
      <p className="text-sm text-slate-500">Torneos y competencias de padel</p>

      <div className="flex gap-2">
        <button type="button" className="ui-btn-primary ui-interactive px-5 py-2 text-sm">
          Disponibles
        </button>
        <button type="button" className="ui-btn-ghost ui-interactive px-5 py-2 text-sm">
          Tus competiciones
        </button>
      </div>

      <section className="space-y-3">
        {tournaments.map((item) => (
          <article key={item.title} className="ui-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
                <p className="text-sm text-slate-500">{item.club}</p>
              </div>
              <span className="ui-chip">{item.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {item.date} - {item.level}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-3xl font-bold text-blue-600">{item.price}</p>
              <button
                type="button"
                className="ui-interactive rounded-3xl px-3 py-2 text-sm font-semibold text-blue-600"
              >
                Ver
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">{item.pairs}</p>
          </article>
        ))}
      </section>

      <BottomNav />
    </main>
  );
}
