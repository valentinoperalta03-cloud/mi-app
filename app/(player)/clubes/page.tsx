"use client";

import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ClubsMap from "@/components/clubs-map";
import { DB_TABLES } from "@/lib/db-tables";
import { PLAYER_CARD, PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";
import MotionPage from "@/components/motion-page";
import { createClient } from "@/utils/supabase/client";

type ClubRow = {
  id: string | number;
  name: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance?: number | null;
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

export default function ClubesPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [viewMode, setViewMode] = useState<"lista" | "mapa">("lista");
  const [sortedClubs, setSortedClubs] = useState<ClubRow[]>([]);

  function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function detectLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        const withDistance = clubs.map((club) => ({
          ...club,
          distance:
            club.latitude != null && club.longitude != null
              ? getDistanceKm(loc.lat, loc.lng, club.latitude, club.longitude)
              : null,
        }));
        setSortedClubs(withDistance.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999)));
      },
      () => alert("No se pudo detectar tu ubicación. Activá el GPS.")
    );
  }

  async function loadClubs(showLoading = false) {
    if (showLoading) setLoading(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from(DB_TABLES.clubs)
      .select("id,name,location,latitude,longitude,cover_image_url,logo_url,description,business_hours");

    if (error) {
      setClubs([]);
      setSortedClubs([]);
      setErrorMessage("No se pudieron cargar los clubes. Intenta nuevamente.");
      setLoading(false);
      return;
    }

    setClubs((data as ClubRow[]) || []);
    setSortedClubs((data as ClubRow[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClubs();
  }, []);

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

  if (loading) {
    return (
      <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
        <div className="shimmer h-8 w-44 rounded-xl" />
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className={`${PLAYER_CARD} p-4`}>
            <div className="flex items-center gap-4">
              <div className="shimmer h-16 w-16 rounded-2xl" />
              <div className="flex-1">
                <div className="shimmer h-5 w-3/4 rounded-md" />
                <div className="mt-3 shimmer h-4 w-1/2 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </MotionPage>
    );
  }

  const clubsToShow = userLocation ? sortedClubs : clubs;

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#0585FC]">Clubes</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Clubes disponibles</h1>
        </div>

        <button
          onClick={detectLocation}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 py-3 text-sm font-semibold text-[#0461C4]"
        >
          <MapPin size={16} />
          {userLocation ? "📍 Ubicación detectada — Ver más cercanos" : "Detectar mi ubicación"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setViewMode("lista")}
            className={`rounded-2xl py-2.5 text-sm font-semibold transition ${
              viewMode === "lista"
                ? "bg-[#0585FC] text-white dark:bg-sky-500"
                : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setViewMode("mapa")}
            className={`rounded-2xl py-2.5 text-sm font-semibold transition ${
              viewMode === "mapa"
                ? "bg-[#0585FC] text-white dark:bg-sky-500"
                : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            Mapa
          </button>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <p>{errorMessage}</p>
          <motion.button
            type="button"
            onClick={() => void loadClubs(true)}
            className="mt-2 rounded-xl bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
            whileTap={{ scale: 0.96 }}
          >
            Reintentar
          </motion.button>
        </div>
      ) : null}

      {viewMode === "mapa" ? (
        <div className="space-y-3">
          <ClubsMap clubs={clubs} userLocation={userLocation} onClubClick={(id) => router.push(`/clubes/${id}`)} />
          <p className="text-center text-xs text-slate-400">Tocá un pin para ver el club</p>
        </div>
      ) : (
        <motion.section variants={listVariants} initial="hidden" animate="show" className="space-y-3">
          {clubsToShow.map((club) => {
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
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0585FC] to-cyan-500 text-sm font-bold text-white ring-1 ring-[#0585FC]/30">
                        {clubInitials(club.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-bold tracking-tight text-slate-950 dark:text-slate-100">
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
                      {club.distance != null ? (
                        <p className="mt-1 text-xs font-medium text-[#0585FC]">📍 {club.distance.toFixed(1)} km</p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </motion.article>
            );
          })}
        </motion.section>
      )}
    </MotionPage>
  );
}
