import MotionPage from "@/components/motion-page";

export default function CrearPartidoLoading() {
  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-5 bg-[var(--bg-app)] px-4 pb-24 pt-6">
      <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
      <div className="h-10 w-52 animate-pulse rounded bg-slate-200" />
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-28 w-full animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </MotionPage>
  );
}
