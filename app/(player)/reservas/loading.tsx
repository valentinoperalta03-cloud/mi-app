import Image from "next/image";

export default function ReservasLoading() {
  return (
    <div
      className="mx-auto min-h-screen w-full max-w-md space-y-6 px-4 pb-24 pt-6"
      aria-busy
      aria-label="Cargando reservas"
    >
      <header className="space-y-2">
        <div className="relative h-6 w-20 overflow-hidden opacity-50">
          <Image src="/logo.png" alt="Padelibre" fill className="object-contain" />
        </div>
        <div className="shimmer h-5 w-20 rounded-full" />
        <div className="shimmer h-8 w-44 rounded-2xl" />
        <div className="shimmer h-4 w-full max-w-xs rounded-xl" />
      </header>

      <section className="space-y-3">
        <div className="shimmer h-4 w-24 rounded-md" />
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="shimmer h-5 w-32 rounded-lg" />
                  <div className="shimmer h-4 w-24 rounded-md" />
                </div>
                <div className="shimmer h-6 w-20 rounded-full" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="shimmer h-3.5 w-full rounded-md" />
                <div className="shimmer h-3.5 w-full rounded-md" />
                <div className="shimmer h-3.5 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="shimmer h-4 w-20 rounded-md" />
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <div className="shimmer h-5 w-28 rounded-lg" />
            <div className="shimmer h-3.5 w-full rounded-md" />
            <div className="shimmer h-3.5 w-2/3 rounded-md" />
          </div>
        </div>
      </section>

      <div className="shimmer h-11 w-full rounded-2xl" />
    </div>
  );
}
