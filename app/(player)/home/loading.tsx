import {
  HomeReservationsSkeleton,
  HomeSectionLineSkeleton,
  HomeSummarySkeleton,
} from "@/components/home-loading-skeletons";

export default function HomeLoading() {
  return (
    <div
      className="home-page-shell mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 bg-transparent px-4 pb-24 pt-6"
      aria-busy
      aria-label="Cargando inicio"
    >
      <div className="shimmer h-28 w-full rounded-3xl" />

      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shimmer min-h-28 rounded-2xl" />
        ))}
      </div>

      <div className="shimmer h-20 w-full rounded-2xl" />

      <section className="space-y-4">
        <div className="shimmer h-7 w-48 rounded-xl" />
        <HomeSectionLineSkeleton />
        <HomeSectionLineSkeleton />
      </section>

      <section className="space-y-4">
        <div className="shimmer h-7 w-36 rounded-xl" />
        <HomeSummarySkeleton />
      </section>

      <section className="space-y-4">
        <div className="shimmer h-7 w-40 rounded-xl" />
        <HomeReservationsSkeleton />
      </section>
    </div>
  );
}
