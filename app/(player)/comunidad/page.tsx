import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { ParaTiCreatePost } from "@/components/para-ti-create-post";
import { ParaTiPostsMotion } from "@/components/para-ti-posts-motion";
import { FriendRequestsSection } from "@/components/friend-requests-section";
import {
  fetchLatestMatchResultForUser,
  fetchPostsFeed,
} from "@/lib/para-ti-posts";
import { createClient } from "@/utils/supabase/server";

export default async function ComunidadPage() {
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
    <MotionPage className="mx-auto min-h-screen w-full max-w-md bg-transparent pb-32 pt-6">
      <header className="mb-4 flex items-center justify-between gap-3 px-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Comunidad
          </h1>
          <p className="text-sm text-[var(--text-tertiary)]">Tu espacio social</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/comunidad/buscar"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] shadow-sm transition hover:border-[#0585FC]/30 hover:text-[#0585FC]"
          >
            <UserPlus size={18} />
          </Link>
          <Link
            href="/comunidad/mensajes"
            className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 text-sm font-semibold text-[var(--text-secondary)] shadow-sm transition hover:border-[#0585FC]/30 hover:text-[#0585FC]"
          >
            Mensajes
          </Link>
        </div>
      </header>

      <div className="mb-4 flex gap-0 border-b border-[var(--border-subtle)] px-4">
        <button
          type="button"
          className="flex-1 border-b-2 border-[#0585FC] pb-3 text-sm font-bold text-[#0585FC]"
        >
          Para ti
        </button>
        <Link
          href="/comunidad/buscar"
          className="flex-1 pb-3 text-center text-sm font-semibold text-[var(--text-tertiary)] transition hover:text-[var(--text-primary)]"
        >
          Jugadores
        </Link>
      </div>

      <div className="px-4">
        <FriendRequestsSection userId={user.id} />
      </div>

      <div className="mt-4 px-4">
        <ParaTiPostsMotion posts={posts} />
      </div>

      <ParaTiCreatePost latestMatch={latestMatch} />
    </MotionPage>
  );
}
