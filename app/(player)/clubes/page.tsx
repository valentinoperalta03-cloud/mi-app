"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
    const { data, error } = await supabase.from("clubs").select("*");

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

  if (loading) return <p className="mx-auto max-w-md px-4 py-6 text-sm">Cargando clubes...</p>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-slate-50 px-4 pb-24 pt-6">
      <h1 className="text-2xl font-bold text-slate-900">Clubes</h1>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => void loadClubs(true)}
            className="mt-2 rounded-xl bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      <section className="space-y-3">
        {clubs.map((club) => (
          <Link
            key={club.id}
            href={`/clubes/${club.id}`}
            className="block rounded-2xl border border-slate-100 bg-white p-5 transition hover:opacity-95"
          >
            <h2 className="text-lg font-semibold text-slate-900">{club.name ?? "Club sin nombre"}</h2>
            <p className="text-sm text-slate-500">{club.location ?? "Sin ubicacion"}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
