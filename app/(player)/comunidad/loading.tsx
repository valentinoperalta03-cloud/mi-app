import Image from "next/image";

export default function ComunidadLoading() {
  return (
    <div
      className="mx-auto min-h-screen w-full max-w-md space-y-8 bg-[var(--bg-app)] px-4 pb-24 pt-6"
      aria-busy
      aria-label="Cargando comunidad"
    >
      <header className="space-y-2">
        <div className="relative h-6 w-20 overflow-hidden opacity-50">
          <Image src="/logo.png" alt="Padelibre" fill className="object-contain" />
        </div>
        <div className="shimmer h-5 w-28 rounded-full" />
        <div className="shimmer h-8 w-48 rounded-2xl" />
        <div className="shimmer h-4 w-full max-w-xs rounded-xl" />
      </header>

      <section className="grid gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="shimmer h-11 w-11 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <div className="shimmer h-4 w-28 rounded-md" />
                <div className="shimmer h-3.5 w-44 rounded-md" />
              </div>
            </div>
            <div className="mt-4 shimmer h-24 w-full rounded-2xl" />
          </div>
        ))}
      </section>
    </div>
  );
}
