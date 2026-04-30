export default function PerfilLoading() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 bg-[var(--bg-app)] px-4 pb-28 pt-6">
      <div
        className="h-72 animate-pulse rounded-[2.5rem] border border-slate-200/40 bg-white shadow-[0_2px_24px_-8px_rgba(15,23,42,0.06)]"
        aria-hidden
      />
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-[2.5rem] bg-white/90" aria-hidden />
        <div className="h-40 animate-pulse rounded-[2.5rem] bg-white/90" aria-hidden />
        <div className="h-32 animate-pulse rounded-[2.5rem] bg-white/90" aria-hidden />
      </div>
      <p className="text-center text-xs text-slate-400">Cargando perfil…</p>
    </div>
  );
}
