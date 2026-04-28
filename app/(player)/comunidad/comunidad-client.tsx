"use client";

import Link from "next/link";
import { useState } from "react";
import MotionPage from "@/components/motion-page";
import { ParaTiCreatePost } from "@/components/para-ti-create-post";
import { ParaTiPostsMotion } from "@/components/para-ti-posts-motion";
import type { LatestMatchLink, PostFeedItem } from "@/lib/para-ti-posts";
import FriendsSearchClient from "./buscar/friends-search-client";

type PlayerCard = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  category?: string | null;
  level?: number | null;
  level_of_play?: string | null;
  technical_score?: number | null;
};

export function ComunidadClient({
  posts,
  latestMatch,
  players,
  initialFollowingIds,
  followsMeIds,
  userId,
}: {
  posts: PostFeedItem[];
  latestMatch: LatestMatchLink;
  players: PlayerCard[];
  initialFollowingIds: string[];
  followsMeIds: string[];
  userId: string;
}) {
  const [activeTab, setActiveTab] = useState<"para-ti" | "jugadores">("para-ti");

  return (
    <MotionPage
      className="mx-auto min-h-screen w-full max-w-md bg-transparent pb-32 pt-6"
      data-user-id={userId}
    >
      <header className="mb-4 flex items-center justify-between gap-3 px-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Comunidad
          </h1>
          <p className="text-sm text-[var(--text-tertiary)]">Tu espacio social</p>
        </div>
        <div className="flex items-center gap-2">
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
          onClick={() => setActiveTab("para-ti")}
          className={`flex-1 pb-3 text-sm transition ${
            activeTab === "para-ti"
              ? "border-b-2 border-[#0585FC] font-bold text-[#0585FC]"
              : "font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Para ti
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("jugadores")}
          className={`flex-1 pb-3 text-sm transition ${
            activeTab === "jugadores"
              ? "border-b-2 border-[#0585FC] font-bold text-[#0585FC]"
              : "font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Jugadores
        </button>
      </div>

      <div className="mt-4 px-4">
        {activeTab === "jugadores" ? (
          <FriendsSearchClient
            players={players}
            initialFollowingIds={initialFollowingIds}
            followsMeIds={followsMeIds}
          />
        ) : (
          <ParaTiPostsMotion posts={posts} />
        )}
      </div>

      {activeTab === "para-ti" ? <ParaTiCreatePost latestMatch={latestMatch} /> : null}
    </MotionPage>
  );
}
