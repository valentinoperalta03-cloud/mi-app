import Link from "next/link";
import { redirect } from "next/navigation";
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
    <MotionPage className="relative mx-auto min-h-screen w-full max-w-md bg-slate-50 px-4 pb-36 pt-6">
      <header className="mb-6 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/comunidad"
            className="text-sm font-semibold text-sky-600 transition hover:text-sky-700"
          >
            ← Comunidad
          </Link>
        </div>
        <p className="text-sm font-medium text-sky-600">Para vos</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Para ti</h1>
        <p className="text-sm text-slate-500">
          Novedades y resultados de quienes juegan con vos.
        </p>
      </header>

      <ParaTiPostsMotion posts={posts} />
      <ParaTiCreatePost latestMatch={latestMatch} />
    </MotionPage>
  );
}
