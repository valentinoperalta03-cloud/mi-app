import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { FriendRequestsSection } from "@/components/friend-requests-section";
import MotionPage from "@/components/motion-page";
import { ParaTiCreatePost } from "@/components/para-ti-create-post";
import { ParaTiPostsMotion } from "@/components/para-ti-posts-motion";
import {
  fetchLatestMatchResultForUser,
  fetchPostsFeed,
} from "@/lib/para-ti-posts";
import { createClient } from "@/utils/supabase/server";

export default async function ParaTiFeedPage() {
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
    <MotionPage className="relative mx-auto min-h-screen w-full max-w-md bg-[var(--bg-app)] px-4 pb-36 pt-6">
      <header className="mb-6 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/comunidad"
            className="text-sm font-semibold text-[#0585FC] transition hover:text-[#0461C4]"
          >
            ← Comunidad
          </Link>
        </div>
        <p className="text-sm font-medium text-[#0585FC]">Para vos</p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Para ti</h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          Novedades y resultados de quienes juegan con vos.
        </p>
      </header>

      <Suspense fallback={null}>
        <FriendRequestsSection userId={user.id} />
      </Suspense>

      <ParaTiPostsMotion posts={posts} />
      <ParaTiCreatePost latestMatch={latestMatch} />
    </MotionPage>
  );
}
