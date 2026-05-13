"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle, Sparkles, Trophy, Users } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { ParaTiCreatePost } from "@/components/para-ti-create-post";
import { ParaTiPostsMotion } from "@/components/para-ti-posts-motion";
import type { LatestMatchLink, PostFeedItem } from "@/lib/para-ti-posts";
import type { RankingsPreview } from "@/lib/rankings-data";
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

type GridTile = {
  id: string;
  label: string;
  Icon: typeof Sparkles;
  ringGradient: string;
  barGradient: string;
  iconClass: string;
  href?: string;
  tab?: "para-ti" | "jugadores";
};

const gridTiles: GridTile[] = [
  {
    id: "para-ti",
    label: "Para Ti",
    Icon: Sparkles,
    ringGradient: "linear-gradient(135deg, #0585FC 0%, #0461C4 40%, #0585FC 100%)",
    barGradient: "linear-gradient(90deg, #0585FC, #0461C4, #0585FC)",
    iconClass: "text-[#0585FC]",
    tab: "para-ti",
  },
  {
    id: "jugadores",
    label: "Jugadores",
    Icon: Users,
    ringGradient: "linear-gradient(135deg, #16a34a 0%, #15803d 45%, #16a34a 100%)",
    barGradient: "linear-gradient(90deg, #16a34a, #15803d, #16a34a)",
    iconClass: "text-[#16a34a]",
    tab: "jugadores",
  },
  {
    id: "mensajes",
    label: "Mensajes",
    Icon: MessageCircle,
    ringGradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 45%, #a855f7 100%)",
    barGradient: "linear-gradient(90deg, #a855f7, #7c3aed, #a855f7)",
    iconClass: "text-[#9333ea]",
    href: "/comunidad/mensajes",
  },
  {
    id: "rankings",
    label: "Rankings",
    Icon: Trophy,
    ringGradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 45%, #f59e0b 100%)",
    barGradient: "linear-gradient(90deg, #f59e0b, #d97706, #f59e0b)",
    iconClass: "text-[#d97706]",
    href: "/comunidad/rankings",
  },
];

function ComunidadGridCard({
  tile,
  activeTab,
  onTab,
}: {
  tile: GridTile;
  activeTab: "para-ti" | "jugadores";
  onTab: (t: "para-ti" | "jugadores") => void;
}) {
  const isActiveTab = tile.tab != null && activeTab === tile.tab;
  const inner = (
    <div
      className={`flex min-h-[100px] flex-col rounded-[22px] bg-white p-3 shadow-[0_4px_20px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.04] transition-transform duration-200 dark:bg-[var(--bg-card)] dark:ring-white/10 ${
        isActiveTab ? "ring-2 ring-[#0585FC]/35" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-[2px]"
          style={{ backgroundImage: tile.ringGradient }}
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-[var(--bg-card)]">
            <tile.Icon className={tile.iconClass} size={22} strokeWidth={2.25} aria-hidden />
          </div>
        </div>
      </div>
      <p className="mt-2 text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">{tile.label}</p>
      <div
        className="comunidad-gradient-animated mt-auto h-1 w-full rounded-full opacity-90"
        style={{ backgroundImage: tile.barGradient }}
      />
    </div>
  );

  if (tile.href) {
    return (
      <Link
        href={tile.href}
        className="comunidad-gradient-animated block min-w-0 rounded-3xl p-[2px] transition-transform active:scale-95"
        style={{ backgroundImage: tile.ringGradient }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => tile.tab && onTab(tile.tab)}
      className="comunidad-gradient-animated block w-full min-w-0 rounded-3xl p-[2px] text-left transition-transform active:scale-95"
      style={{ backgroundImage: tile.ringGradient }}
    >
      {inner}
    </button>
  );
}

export function ComunidadClient({
  posts,
  latestMatch,
  players,
  initialFollowingIds,
  followsMeIds,
  userId,
  rankingsPreview,
}: {
  posts: PostFeedItem[];
  latestMatch: LatestMatchLink;
  players: PlayerCard[];
  initialFollowingIds: string[];
  followsMeIds: string[];
  userId: string;
  rankingsPreview: RankingsPreview;
}) {
  const [activeTab, setActiveTab] = useState<"para-ti" | "jugadores">("para-ti");

  return (
    <MotionPage
      className="mx-auto min-h-screen w-full max-w-md bg-transparent pb-32 pt-6"
      data-user-id={userId}
    >
      <header className="mb-5 px-4">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Comunidad</h1>
        <p className="text-sm text-[var(--text-tertiary)]">Tu espacio social</p>
        {rankingsPreview.myGlobalPosition != null && rankingsPreview.totalRankedPlayers > 0 ? (
          <p className="mt-2 text-xs font-medium text-[var(--text-secondary)]">
            Tu ranking global:{" "}
            <Link href="/comunidad/rankings" className="font-bold text-[#0585FC] underline-offset-2 hover:underline">
              #{rankingsPreview.myGlobalPosition}
            </Link>{" "}
            de {rankingsPreview.totalRankedPlayers} jugadores
            {rankingsPreview.weeklyFirstName ? (
              <span className="text-[var(--text-tertiary)]">
                {" "}
                · Líder de la semana: {rankingsPreview.weeklyFirstName}
              </span>
            ) : null}
          </p>
        ) : null}
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 px-4">
        {gridTiles.map((tile) => (
          <ComunidadGridCard key={tile.id} tile={tile} activeTab={activeTab} onTab={setActiveTab} />
        ))}
      </div>

      <div className="mt-2 px-4">
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
