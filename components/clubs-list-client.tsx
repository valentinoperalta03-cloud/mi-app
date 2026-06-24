"use client";

import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PlayerStackHeader } from "@/components/player-back-button";
import { formatCityLabel } from "@/lib/locations";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";

export type ClubRow = {
  id: string | number;
  name: string | null;
  location?: string | null;
  cover_image_url?: string | null;
  logo_url?: string | null;
  description?: string | null;
  business_hours?: string | null;
};

function clubThumbUrl(club: ClubRow): string | null {
  const cover = club.cover_image_url?.trim();
  const logo = club.logo_url?.trim();
  return cover || logo || null;
}

function clubInitials(name: string | null): string {
  const n = (name ?? "Club").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0] + parts[1]![0]).toUpperCase();
  return n.slice(0, 2).toUpperCase() || "CL";
}

function shortDescription(desc: string | null | undefined, max = 120): string | null {
  const t = (desc ?? "").trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max).trim()}…`;
}

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24 } },
};

export default function ClubsListClient({
  clubs,
  userCity,
  errorMessage,
  errorDebug,
}: {
  clubs: ClubRow[];
  userCity?: string | null;
  errorMessage: string | null;
  /** Detalle técnico (p. ej. mensaje PostgREST) para depuración */
  errorDebug?: string | null;
}) {
  const router = useRouter();
  const cityLabel = formatCityLabel(userCity);

  return (
    <>
      <PlayerStackHeader
        backHref="/home"
        backLabel="Volver al inicio"
        title={`Clubes en ${cityLabel}`}
        subtitle="Explorá clubes de tu ciudad"
        className="mb-1"
      />

      <div className="flex items-center gap-2 rounded-2xl border border-sky-200/80 bg-sky-50/80 px-3 py-2 text-sm text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-100">
        <MapPin className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <span>
          Mostrando clubes en <span className="font-semibold">{cityLabel}</span>
        </span>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <p>{errorMessage}</p>
          {errorDebug ? (
            <p className="mt-2 break-words font-mono text-xs text-rose-600/90 dark:text-rose-300/90">{errorDebug}</p>
          ) : null}
          <motion.button
            type="button"
            onClick={() => router.refresh()}
            className="mt-2 rounded-xl bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
            whileTap={{ scale: 0.96 }}
          >
            Reintentar
          </motion.button>
        </div>
      ) : null}

      {!errorMessage && clubs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">No hay clubes en {cityLabel}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Todavía no hay clubes registrados en tu ciudad. Probá cambiar tu ubicación en Ajustes.
          </p>
        </div>
      ) : null}

      <motion.section variants={listVariants} initial="hidden" animate="show" className="space-y-3">
        {clubs.map((club) => {
          const thumb = clubThumbUrl(club);
          const descShort = shortDescription(club.description);
          return (
            <motion.article key={club.id} variants={itemVariants} layoutId={`club-card-${club.id}`}>
              <Link href={`/clubes/${club.id}`} className={`block p-5 ${PLAYER_CARD_INTERACTIVE}`}>
                <div className="flex items-start gap-4">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200/80 dark:ring-slate-700"
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white ring-1 ring-[#0585FC]/30"
                      style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
                    >
                      {clubInitials(club.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                      {club.name ?? "Club sin nombre"}
                    </h2>
                    <p className="truncate text-sm font-light text-slate-500 dark:text-slate-400">
                      {club.location ?? "Sin ubicación"}
                    </p>
                    {descShort ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {descShort}
                      </p>
                    ) : null}
                    {club.business_hours?.trim() ? (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#0461C4] dark:text-sky-400">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{club.business_hours.trim()}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            </motion.article>
          );
        })}
      </motion.section>
    </>
  );
}
