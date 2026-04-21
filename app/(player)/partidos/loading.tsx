import Image from "next/image";

export default function PartidosLoading() {
  return (
    <div
      className="mx-auto min-h-screen w-full max-w-md space-y-6 px-4 pb-24 pt-6"
      aria-busy
      aria-label="Cargando partidos"
    >
      <header className="space-y-2">
        <div className="relative h-6 w-20 overflow-hidden opacity-50">
          <Image src="/logo-marca.png" alt="Padelibre" fill className="object-contain" />
        </div>
        <div className="shimmer h-5 w-20 rounded-full" />
        <div className="shimmer h-8 w-44 rounded-2xl" />
        <div className="shimmer h-4 w-full max-w-xs rounded-xl" />
      </header>
      <section className="space-y-4">
        {[0, 1, 2].map((i) => (
          <article key={i} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="shimmer h-16 w-16 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="shimmer h-5 w-40 rounded-lg" />
                <div className="shimmer h-3.5 w-28 rounded-md" />
              </div>
              <div className="shimmer h-6 w-14 rounded-full" />
            </div>
            <div className="mt-3 shimmer h-3.5 w-40 rounded-md" />
            <div className="mt-3 flex items-center justify-between">
              <div className="shimmer h-6 w-20 rounded-lg" />
              <div className="shimmer h-4 w-24 rounded-md" />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
