import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { ParaTiCreatePostButton } from "@/components/para-ti-create-post";
import { ParaTiPostsMotion } from "@/components/para-ti-posts-motion";
import { fetchFeedWithMatches } from "@/lib/para-ti-posts";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export default async function ParaTiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRow } = await supabase
    .from(DB_TABLES.profiles)
    .select("city")
    .eq("user_id", user.id)
    .maybeSingle();
  const userCity = (profileRow as { city?: string | null } | null)?.city?.trim() ?? "";

  const feedItems = await fetchFeedWithMatches(supabase, userCity);

  return (
    <MotionPage className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden bg-transparent pb-32 pt-5">
      <div className="px-4">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/comunidad"
                className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--bg-card)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] dark:ring-white/10"
              >
                <ChevronLeft size={20} className="text-[var(--text-secondary)]" />
              </Link>
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Feed</h1>
            </div>
            <p className="mt-1 pl-11 text-sm text-[var(--text-tertiary)]">
              Partidos abiertos y publicaciones de la comunidad
            </p>
          </div>
          <ParaTiCreatePostButton />
        </div>

        <section className="min-w-0 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/95 p-4 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] backdrop-blur-sm dark:bg-[var(--bg-card)]/90 dark:ring-white/[0.06]">
          <ParaTiPostsMotion items={feedItems} />
        </section>
      </div>
    </MotionPage>
  );
}
