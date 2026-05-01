import Image from "next/image";

export default function JugadorPerfilLoading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md space-y-5 px-4 pb-28 pt-6" aria-busy aria-label="Cargando perfil">
      <div className="relative h-6 w-20 overflow-hidden opacity-50">
        <Image src="/logo.png" alt="Padelibre" fill className="object-contain" />
      </div>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto shimmer h-28 w-28 rounded-full" />
        <div className="mx-auto mt-5 shimmer h-7 w-40 rounded-xl" />
        <div className="mx-auto mt-2 shimmer h-4 w-32 rounded-md" />
      </section>

      <section className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="shimmer h-4 w-16 rounded-md" />
            <div className="mt-2 shimmer h-6 w-14 rounded-lg" />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="shimmer h-5 w-40 rounded-lg" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm">
            <div className="shimmer h-4 w-24 rounded-md" />
            <div className="mt-2 shimmer h-4 w-32 rounded-md" />
          </div>
        ))}
      </section>
    </div>
  );
}
