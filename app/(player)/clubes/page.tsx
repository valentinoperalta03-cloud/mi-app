"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DB_TABLES } from "@/lib/db-tables";
import { supabase } from "@/lib/supabase";
import MotionPage from "@/components/motion-page";

type ClubRow = {
  id: string | number;
  name: string | null;
  location?: string | null;
};

export default function ClubesPage() {
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadClubs(showLoading = false) {
    if (showLoading) setLoading(true);
    setErrorMessage(null);
    const { data, error } = await supabase.from(DB_TABLES.clubs).select("*");

    if (error) {
      setClubs([]);
      setErrorMessage("No se pudieron cargar los clubes. Intenta nuevamente.");
      setLoading(false);
      return;
    }

    setClubs(data || []);
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
          <div key={idx} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
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

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Clubes</h1>
      <p className="text-sm font-light text-slate-500">Elegi un club para ver horarios disponibles.</p>

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

      <motion.section variants={listVariants} initial="hidden" animate="show" className="space-y-3">
        {clubs.map((club) => (
          <motion.article key={club.id} variants={itemVariants} layoutId={`club-card-${club.id}`}>
            <Link
              href={`/clubes/${club.id}`}
              className="block rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-sky-200 hover:shadow-lg active:scale-95"
            >
              <div className="flex items-center gap-4">
                <Image
                  src="/club-thumb.svg"
                  alt="Vista previa del club"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
                <div className="flex-1">
                  <h2 className="text-lg font-bold tracking-tight text-slate-950">
                    {club.name ?? "Club sin nombre"}
                  </h2>
                  <p className="text-sm font-light text-slate-500">
                    {club.location ?? "Sin ubicacion"}
                  </p>
                </div>
              </div>
            </Link>
          </motion.article>
        ))}
      </motion.section>
    </MotionPage>
  );
}
