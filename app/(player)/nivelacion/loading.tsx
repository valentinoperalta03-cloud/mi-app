export default function NivelacionLoading() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-[var(--bg-app)] px-4 pb-28 pt-6">
      <div className="h-36 animate-pulse rounded-[2.5rem] bg-white shadow-sm" aria-hidden />
      <div className="h-64 animate-pulse rounded-[2.5rem] bg-white shadow-sm" aria-hidden />
      <p className="text-center text-xs text-slate-400">Cargando…</p>
    </div>
  );
}
