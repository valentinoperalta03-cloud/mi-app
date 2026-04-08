import BottomNav from "@/components/bottom-nav";

const clubs = [
  {
    name: "Top Padel Sports",
    address: "Av. Libertador 890",
    price: "$7.500/h",
    tags: ["indoor", "panoramica"],
    courts: "8 canchas",
    rating: "4.9",
  },
  {
    name: "Padel Club Centro",
    address: "Av. Corrientes 1234",
    price: "$5.000/h",
    tags: ["indoor", "cristal"],
    courts: "6 canchas",
    rating: "4.8",
  },
  {
    name: "Arena Padel",
    address: "Calle Mitre 567",
    price: "$4.500/h",
    tags: ["outdoor", "padel"],
    courts: "4 canchas",
    rating: "4.5",
  },
];

export default function ReservasPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-[hsl(var(--background))] px-4 pb-24 pt-6">
      <p className="text-sm font-medium text-blue-600">Inicio</p>
      <h1 className="text-2xl font-bold text-slate-900">Reservar pista</h1>
      <p className="text-sm text-slate-500">Encontra la cancha ideal cerca tuyo</p>

      <button type="button" className="ui-btn-ghost ui-interactive w-full text-left">
        Filtros
      </button>

      <p className="text-sm text-slate-500">{clubs.length} clubes encontrados</p>

      <section className="space-y-3">
        {clubs.map((club) => (
          <article key={club.name} className="ui-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{club.name}</h2>
                <p className="text-sm text-slate-500">{club.address}</p>
              </div>
              <p className="text-sm font-semibold text-amber-500">{club.rating}</p>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs">
              {club.tags.map((tag) => (
                <span key={tag} className="ui-chip">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-blue-600">{club.price}</p>
                <p className="text-sm text-slate-500">{club.courts}</p>
              </div>
              <button
                type="button"
                className="ui-interactive rounded-3xl px-3 py-2 text-sm font-semibold text-blue-600"
              >
                Reservar
              </button>
            </div>
          </article>
        ))}
      </section>

      <BottomNav />
    </main>
  );
}
