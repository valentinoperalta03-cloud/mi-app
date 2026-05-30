import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HomeSuggestionsSection } from "@/components/home-suggestions-section";
import { HomeSuggestionsSkeleton } from "@/components/home-loading-skeletons";
import MotionPage from "@/components/motion-page";
import { ParaTiCreatePost } from "@/components/para-ti-create-post";
import { ParaTiPostsMotion } from "@/components/para-ti-posts-motion";
import { PlayerStackHeader } from "@/components/player-back-button";
import { fetchLatestMatchResultForUser, fetchPostsFeed } from "@/lib/para-ti-posts";
import { createClient } from "@/utils/supabase/server";

export default async function ParaTiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [posts, latestMatch] = await Promise.all([
    fetchPostsFeed(supabase),
    fetchLatestMatchResultForUser(supabase, user.id),
  ]);

  return (
    <MotionPage className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden bg-transparent pb-32 pt-5">
      <div className="px-4">
        <PlayerStackHeader
          backHref="/comunidad"
          backLabel="Volver a Comunidad"
          title="Para Ti"
          subtitle="Novedades y sugerencias de la comunidad"
        />

        <section className="mb-5 min-w-0 space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Sugerencias para vos</h2>
          <Suspense fallback={<HomeSuggestionsSkeleton />}>
            <HomeSuggestionsSection userId={user.id} />
          </Suspense>
        </section>

        <section className="min-w-0 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/95 p-4 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] backdrop-blur-sm dark:bg-[var(--bg-card)]/90 dark:ring-white/[0.06]">
          <ParaTiPostsMotion posts={posts} />
        </section>
      </div>

      <ParaTiCreatePost latestMatch={latestMatch} />
    </MotionPage>
  );
}
