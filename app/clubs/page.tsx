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

  useEffect(() => {
    async function loadClubs() {
      const { data, error } = await supabase
        .from("clubs")
        .select("*");

      if (error) {
        console.error("Error cargando clubs:", error);
      } else {
        setClubs(data || []);
      }

      setLoading(false);
    }

    loadClubs();
  }, []);

  if (loading) return <p>Cargando clubes...</p>;

  return (
    <div>
      <h1>Clubs</h1>

      {clubs.map((club) => (
        <Link key={club.id} href={`/clubs/${club.id}`} className="block">
          <h3>{club.name}</h3>
          <p>{club.location}</p>
        </Link>
      ))}
    </div>
  );
}