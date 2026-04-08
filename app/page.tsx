import BottomNav from "@/components/bottom-nav";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-100">
      <section className="rounded-b-3xl bg-blue-700 px-5 pb-6 pt-8 text-white shadow-sm">
        <p className="text-sm text-blue-100">Vamos!</p>
        <h1 className="mt-1 text-4xl font-extrabold leading-tight">
          Todo listo para tu partido.
        </h1>
        <p className="mt-2 text-sm text-blue-100">Jugador</p>
      </section>

      <section className="-mt-4 grid grid-cols-2 gap-3 px-4">
        {[
          ["Reservar pista", "Encontra y reserva tu cancha ideal"],
          ["Aprender", "Clases y entrenamientos para mejorar"],
          ["Competir", "Torneos y competencias activas"],
          ["Buscar partido", "Unite a partidos abiertos"],
        ].map(([title, subtitle]) => (
          <article key={title} className="ui-card ui-interactive p-5">
            <div className="mb-3 h-10 w-10 rounded-2xl bg-sky-100" />
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 px-4">
        <h3 className="text-2xl font-bold text-slate-900">Proximo partido</h3>
        <article className="mt-3 rounded-3xl bg-blue-700 p-5 text-white shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
          <p className="text-2xl font-bold">Dobles intermedio</p>
          <p className="text-sm text-blue-100">Padel Club Centro</p>
          <button
            type="button"
            className="mt-3 w-full rounded-3xl bg-blue-500/60 px-4 py-2 text-center font-semibold transition-all hover:opacity-95 active:scale-95"
          >
            Ver detalles
          </button>
        </article>
      </section>

      <section className="mt-6 px-4 pb-24">
        <h3 className="text-2xl font-bold text-slate-900">Tu resumen</h3>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            ["12", "Partidos"],
            ["18", "Reservas"],
            ["6ta", "Nivel"],
          ].map(([value, label]) => (
            <article key={label} className="ui-card p-5 text-center">
              <p className="text-3xl font-extrabold text-slate-900">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </article>
          ))}
        </div>
      </section>
      <BottomNav />
    </main>
  );
}