"use client";

import Link from "next/link";
import { MessageSquareDashed } from "lucide-react";
import { motion } from "framer-motion";
import { ProfileAvatar } from "@/components/profile-avatar";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { PostFeedItem } from "@/lib/para-ti-posts";

export function ParaTiPostsMotion({ posts }: { posts: PostFeedItem[] }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800">
        <EmptyState
          icon={MessageSquareDashed}
          title="Todavía no hay publicaciones"
          description="Sé el primero en compartir algo con la comunidad."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((p, i) => {
        const name = p.profiles?.name?.trim() || "Jugador";
        const postTypeLabel =
          p.post_type === "photo" ? "📸 Foto" : p.post_type === "result" ? "🏆 Resultado" : "📝 Texto";

        return (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[2.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.16)]"
          >
            <div className="flex gap-3">
              <Link href={`/jugador/${p.user_id}`} className="shrink-0">
                <ProfileAvatar
                  avatarUrl={p.profiles?.avatar_url ?? null}
                  name={name}
                  size={48}
                  ringClassName="ring-2 ring-slate-100"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                  <Link
                    href={`/jugador/${p.user_id}`}
                    className="font-semibold text-slate-900 hover:text-[#0461C4]"
                  >
                    {name}
                  </Link>
                  <RelativeTime
                    iso={p.created_at}
                    className="text-xs font-medium text-slate-400"
                  />
                </div>
                <div className="mt-2">
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {postTypeLabel}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {p.content}
                </p>
                {p.image_url && p.post_type === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagen pública servida desde storage
                  <img src={p.image_url} alt="Foto del post" className="mt-3 max-h-64 w-full rounded-2xl object-cover" />
                ) : null}
                {p.post_type === "result" && p.scoreLabel ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1.5 dark:bg-amber-950/30">
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300">🏆 {p.scoreLabel}</span>
                  </div>
                ) : null}
                {p.post_type === "result" && !p.scoreLabel && p.match_id ? (
                  <Badge variant="brand" className="mt-3 inline-flex items-center">
                    <span className="mr-1.5" aria-hidden>
                      🏆
                    </span>
                    Partido vinculado
                  </Badge>
                ) : null}
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
