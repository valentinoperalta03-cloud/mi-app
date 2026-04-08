"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ClubRow = {
  id: string | number;
  name: string | null;
  location?: string | null;
};

export default function ClubsPage() {
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadClubs(showLoading = false) {
    if (showLoading) {
      setLoading(true);
    }
    setErrorMessage(null);
    const { data, error } = await supabase.from("clubs").select("*");

    if (error) {
      console.error("Error cargando clubs:", error);
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

  if (loading) return <p>Cargando clubes...</p>;

  return (
    <div>
      <h1>Clubs</h1>
      {errorMessage ? (
        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
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

      {clubs.map((club) => (
        <Link key={club.id} href={`/clubs/${club.id}`} className="block">
          <h3>{club.name}</h3>
          <p>{club.location}</p>
        </Link>
      ))}
    </div>
  );
}