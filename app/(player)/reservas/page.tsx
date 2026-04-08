import Link from "next/link";
import MotionPage from "@/components/motion-page";

const clubs = [
  { id: "1", name: "Top Padel Sports", address: "Av. Libertador 890", price: "$7.500/h", courts: "8 canchas", rating: "4.9" },
  { id: "2", name: "Padel Club Centro", address: "Av. Corrientes 1234", price: "$5.000/h", courts: "6 canchas", rating: "4.8" },
  { id: "3", name: "Arena Padel", address: "Calle Mitre 567", price: "$4.500/h", courts: "4 canchas", rating: "4.5" },
];

export default function ReservasPage() {
  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <p className="text-sm font-medium text-sky-500">Inicio</p>
      <h1 className="text-2xl font-bold text-slate-900">Reservar pista</h1>
      <p className="text-sm text-slate-500">Encontra la cancha ideal cerca tuyo</p>

      <p className="text-sm text-slate-500">{clubs.length} clubes encontrados</p>

      <section className="space-y-3">
        {clubs.map((club) => (
          <article
            key={club.name}
            className="rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-sky-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{club.name}</h2>
                <p className="text-sm text-slate-500">{club.address}</p>
              </div>
              <p className="text-sm font-semibold text-amber-500">{club.rating}</p>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-sky-500">{club.price}</p>
                <p className="text-sm text-slate-500">{club.courts}</p>
              </div>
              <Link
                href={`/clubes/${club.id}`}
                className="rounded-2xl px-3 py-2 text-sm font-semibold text-sky-500 transition-all duration-300 hover:opacity-95 active:scale-95"
              >
                Reservar
              </Link>
            </div>
          </article>
        ))}
      </section>
    </MotionPage>
  );
}
