"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ProfileAvatar } from "@/components/profile-avatar";
import { RelativeTime } from "@/components/relative-time";
import type { PostFeedItem } from "@/lib/para-ti-posts";

export function ParaTiPostsMotion({ posts }: { posts: PostFeedItem[] }) {
  if (posts.length === 0) {
    return (
      <p className="rounded-[2.5rem] border border-dashed border-slate-200/90 bg-white/90 px-5 py-8 text-center text-sm text-slate-500">
        Todavía no hay publicaciones. Sé el primero en compartir algo con la comunidad.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((p, i) => {
        const name = p.profiles?.name?.trim() || "Jugador";

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
                    className="font-semibold text-slate-900 hover:text-sky-700"
                  >
                    {name}
                  </Link>
                  <RelativeTime
                    iso={p.created_at}
                    className="text-xs font-medium text-slate-400"
                  />
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {p.content}
                </p>
                {p.match_id ? (
                  <p className="mt-3 inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200/60">
                    <span className="mr-1.5" aria-hidden>
                      🏆
                    </span>
                    {p.scoreLabel ?? "Partido vinculado"}
                  </p>
                ) : null}
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
