import Link from "next/link";
import { Suspense } from "react";
import { HomeSuggestedClubs, HomeSuggestionsSection } from "@/components/home-suggestions-section";
import { HomeSuggestionsSkeleton } from "@/components/home-loading-skeletons";
import { MessageCircle, Sparkles, Trophy, Users } from "lucide-react";
import MotionPage from "@/components/motion-page";
import type { RankingsPreview } from "@/lib/rankings-data";

type TileVisual = {
  id: string;
  label: string;
  Icon: typeof Sparkles;
  ringGradient: string;
  barGradient: string;
  iconClass: string;
};

const tileVisuals: TileVisual[] = [
  {
    id: "para-ti",
    label: "Para Ti",
    Icon: Sparkles,
    ringGradient: "linear-gradient(135deg, #0585FC 0%, #0461C4 40%, #0585FC 100%)",
    barGradient: "linear-gradient(90deg, #0585FC, #0461C4, #0585FC)",
    iconClass: "text-[#0585FC]",
  },
  {
    id: "jugadores",
    label: "Jugadores",
    Icon: Users,
    ringGradient: "linear-gradient(135deg, #16a34a 0%, #15803d 45%, #16a34a 100%)",
    barGradient: "linear-gradient(90deg, #16a34a, #15803d, #16a34a)",
    iconClass: "text-[#16a34a]",
  },
  {
    id: "mensajes",
    label: "Mensajes",
    Icon: MessageCircle,
    ringGradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 45%, #a855f7 100%)",
    barGradient: "linear-gradient(90deg, #a855f7, #7c3aed, #a855f7)",
    iconClass: "text-[#9333ea]",
  },
  {
    id: "rankings",
    label: "Rankings",
    Icon: Trophy,
    ringGradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 45%, #f59e0b 100%)",
    barGradient: "linear-gradient(90deg, #f59e0b, #d97706, #f59e0b)",
    iconClass: "text-[#d97706]",
  },
];

const hrefs: Record<string, string> = {
  "para-ti": "/comunidad/para-ti",
  jugadores: "/comunidad/jugadores",
  mensajes: "/comunidad/mensajes",
  rankings: "/comunidad/rankings",
};

const outerTileClass =
  "comunidad-gradient-animated block min-h-[112px] w-full min-w-0 rounded-3xl p-[2.5px] text-left shadow-[0_2px_12px_rgba(15,23,42,0.06)] outline-none transition-[transform,box-shadow] duration-200 hover:shadow-[0_8px_28px_rgba(15,23,42,0.1)] active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[#0585FC] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)] touch-manipulation dark:focus-visible:ring-offset-black";

function ComunidadNavTile({ tile, href }: { tile: TileVisual; href: string }) {
  const inner = (
    <div className="relative flex min-h-[106px] flex-col rounded-[20px] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-6px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.05] transition-shadow duration-200 dark:bg-[var(--bg-card)] dark:ring-white/[0.08]">
      <div className="flex items-start gap-2.5">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-[2.5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
          style={{ backgroundImage: tile.ringGradient }}
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-white shadow-inner dark:bg-[var(--bg-card)]">
            <tile.Icon className={tile.iconClass} size={22} strokeWidth={2.25} aria-hidden />
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">{tile.label}</p>
      <div
        className="comunidad-gradient-animated mt-auto h-[3px] w-full rounded-full opacity-95"
        style={{ backgroundImage: tile.barGradient }}
      />
    </div>
  );

  return (
    <Link
      href={href}
      prefetch
      aria-label={`Ir a ${tile.label}`}
      className={outerTileClass}
      style={{ backgroundImage: tile.ringGradient }}
    >
      {inner}
    </Link>
  );
}

export function ComunidadClient({
  rankingsPreview,
  userId,
}: {
  rankingsPreview: RankingsPreview;
  userId: string;
}) {
  return (
    <MotionPage className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden bg-transparent pb-32 pt-5">
      <header className="mx-4 mb-6 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/90 px-4 py-4 shadow-[var(--shadow-card)] backdrop-blur-md dark:bg-[var(--bg-card)]/95">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-[var(--text-primary)]">Comunidad</h1>
        <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">Tu espacio social</p>
        {rankingsPreview.myGlobalPosition != null && rankingsPreview.totalRankedPlayers > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--bg-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
            <span>
              Tu ranking global:{" "}
              <Link
                href="/comunidad/rankings"
                prefetch
                className="font-bold text-[#0585FC] underline-offset-2 hover:underline"
              >
                #{rankingsPreview.myGlobalPosition}
              </Link>{" "}
              de {rankingsPreview.totalRankedPlayers} jugadores
            </span>
            {rankingsPreview.weeklyFirstName ? (
              <span className="text-[var(--text-tertiary)]">· Líder de la semana: {rankingsPreview.weeklyFirstName}</span>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="grid min-w-0 grid-cols-2 gap-3 px-4 sm:gap-3.5">
        {tileVisuals.map((tile) => (
          <ComunidadNavTile key={tile.id} tile={tile} href={hrefs[tile.id] ?? "/comunidad"} />
        ))}
      </div>

      <div className="mt-6 space-y-5 px-4">
        <section className="space-y-3">
          <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">Jugadores para vos</h2>
          <Suspense fallback={<HomeSuggestionsSkeleton />}>
            <HomeSuggestionsSection userId={userId} />
          </Suspense>
        </section>
        <section className="space-y-3">
          <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">Clubes cerca tuyo</h2>
          <Suspense fallback={<HomeSuggestionsSkeleton />}>
            <HomeSuggestedClubs />
          </Suspense>
        </section>
      </div>
    </MotionPage>
  );
}
