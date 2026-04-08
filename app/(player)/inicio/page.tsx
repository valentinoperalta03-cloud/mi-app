import Link from "next/link";
import MotionPage from "@/components/motion-page";

const quickActions = [
  {
    title: "Reservar pista",
    subtitle: "Encontra y reserva tu cancha ideal",
    href: "/clubes",
  },
  { title: "Aprender", subtitle: "Clases y entrenamientos para mejorar", href: "/perfil" },
  { title: "Competir", subtitle: "Torneos y competencias activas", href: "/partidos" },
  { title: "Buscar partido", subtitle: "Unite a partidos abiertos", href: "/partidos" },
];

export default function InicioPage() {
  return (
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col space-y-6 bg-transparent px-4 pb-24 pt-6">
      <section className="rounded-[24px] bg-blue-700 px-5 pb-6 pt-6 text-white shadow-sm">
        <p className="text-sm font-light text-blue-100">Vamos!</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight">Todo listo para tu partido.</h1>
        <p className="mt-2 text-sm font-light text-blue-100">Jugador</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {quickActions.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-sky-200 hover:shadow-lg active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-sky-100" />
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
                <p className="text-sm text-slate-500">{item.subtitle}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="text-2xl font-bold text-slate-900">Proximo partido</h3>
        <article className="rounded-[24px] bg-blue-700 p-5 text-white shadow-sm">
          <p className="text-xl font-bold">Dobles intermedio</p>
          <p className="text-sm text-blue-100">Padel Club Centro</p>
          <Link
            href="/partidos"
            className="mt-3 block w-full rounded-3xl bg-blue-500/60 px-4 py-2 text-center font-semibold transition-all duration-300 hover:opacity-95 active:scale-95"
          >
            Ver detalles
          </Link>
        </article>
      </section>

      <section className="space-y-3">
        <h3 className="text-2xl font-bold text-slate-900">Tu resumen</h3>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            ["12", "Partidos"],
            ["18", "Reservas"],
            ["6ta", "Nivel"],
          ].map(([value, label]) => (
            <article
              key={label}
              className="rounded-2xl border border-slate-100 bg-white/95 p-5 text-center shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
            >
              <p className="text-3xl font-extrabold text-slate-900">{value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </article>
          ))}
        </div>
      </section>
    </MotionPage>
  );
}
