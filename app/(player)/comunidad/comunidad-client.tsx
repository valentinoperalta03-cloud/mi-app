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
  accent: string;
  accentBg: string;
};

const tileVisuals: TileVisual[] = [
  {
    id: "para-ti",
    label: "Para Ti",
    Icon: Sparkles,
    accent: "#CCFF00",
    accentBg: "rgba(204,255,0,0.1)",
  },
  {
    id: "jugadores",
    label: "Jugadores",
    Icon: Users,
    accent: "#0585FC",
    accentBg: "rgba(5,133,252,0.1)",
  },
  {
    id: "mensajes",
    label: "Mensajes",
    Icon: MessageCircle,
    accent: "#0585FC",
    accentBg: "rgba(5,133,252,0.1)",
  },
  {
    id: "rankings",
    label: "Rankings",
    Icon: Trophy,
    accent: "#0585FC",
    accentBg: "rgba(5,133,252,0.1)",
  },
];

const hrefs: Record<string, string> = {
  "para-ti": "/comunidad/para-ti",
  jugadores: "/comunidad/jugadores",
  mensajes: "/comunidad/mensajes",
  rankings: "/comunidad/rankings",
};

function ComunidadNavTile({ tile, href }: { tile: TileVisual; href: string }) {
  return (
    <Link
      href={href}
      prefetch
      aria-label={`Ir a ${tile.label}`}
      className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] transition active:scale-[0.96]"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: tile.accentBg }}
      >
        <tile.Icon size={20} style={{ color: tile.accent }} strokeWidth={2.1} aria-hidden />
      </div>
      <p className="text-sm font-bold text-[var(--text-primary)]">{tile.label}</p>
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
      <header className="mx-4 mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Comunidad</h1>
        <p className="text-sm text-[var(--text-tertiary)]">Conectate con otros jugadores</p>
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
          <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
            Jugadores con los que podrías jugar
          </h2>
          <Suspense fallback={<HomeSuggestionsSkeleton />}>
            <HomeSuggestionsSection userId={userId} context="comunidad" />
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
