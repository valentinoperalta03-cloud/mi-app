import Image from "next/image";

export default function ClubesLoading() {
  return (
    <div
      className="mx-auto min-h-screen w-full max-w-md space-y-4 px-4 pb-24 pt-6"
      aria-busy
      aria-label="Cargando clubes"
    >
      <header className="space-y-3">
        <div className="relative h-6 w-20 overflow-hidden opacity-50">
          <Image src="/logo.png" alt="Padelibre" fill className="object-contain" />
        </div>
        <div className="shimmer h-5 w-20 rounded-full" />
        <div className="shimmer h-8 w-56 rounded-2xl" />
        <div className="shimmer h-11 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-2">
          <div className="shimmer h-10 w-full rounded-2xl" />
          <div className="shimmer h-10 w-full rounded-2xl" />
        </div>
      </header>

      <section className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <article key={i} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="shimmer h-16 w-16 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="shimmer h-5 w-36 rounded-lg" />
                <div className="shimmer h-3.5 w-24 rounded-md" />
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
