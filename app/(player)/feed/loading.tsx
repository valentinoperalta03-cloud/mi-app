import MotionPage from "@/components/motion-page";

export default function FeedLoading() {
  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-2xl space-y-4 px-4 pb-24 pt-6">
      <div className="space-y-2">
        <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-52 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>

      {[1, 2, 3].map((item) => (
        <article
          key={item}
          className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-56 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
          <div className="h-9 w-24 animate-pulse rounded-2xl bg-[#0085FC]/10" />
        </article>
      ))}
    </MotionPage>
  );
}
