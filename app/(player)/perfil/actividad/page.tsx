import { redirect } from "next/navigation";
import ActivityTabs from "./activity-tabs";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type MatchActivity = {
  id: string;
  scheduled_date: string | null;
  match_type: string | null;
  match_status: string | null;
  club_name: string;
};

type ReservationActivity = {
  id: string;
  scheduled_date: string | null;
  match_status: string | null;
  court_name: string;
  total_price: number | null;
};

export default async function PerfilActividadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: matchesRaw } = await supabase
    .from(DB_TABLES.matches)
    .select("id, scheduled_date, match_type, match_status, court_id")
    .eq("owner_id", user.id)
    .neq("match_type", "reservation")
    .order("scheduled_date", { ascending: false })
    .limit(20);

  const matchCourtIds = [...new Set((matchesRaw ?? []).map((m: { court_id: string | null }) => m.court_id).filter(Boolean))];
  const { data: matchCourts } =
    matchCourtIds.length > 0
      ? await supabase.from(DB_TABLES.courts).select("id, clubs ( name )").in("id", matchCourtIds as string[])
      : { data: [] };

  const matchClubNameByCourt = new Map<string, string>();
  for (const row of matchCourts ?? []) {
    const typed = row as { id: string; clubs: { name: string | null } | { name: string | null }[] | null };
    const rel = Array.isArray(typed.clubs) ? typed.clubs[0] ?? null : typed.clubs;
    matchClubNameByCourt.set(typed.id, rel?.name ?? "Club");
  }

  const matches: MatchActivity[] = (matchesRaw ?? []).map((row: Record<string, unknown>) => {
    const courtId = String(row.court_id ?? "");
    return {
      id: String(row.id ?? ""),
      scheduled_date: (row.scheduled_date as string | null) ?? null,
      match_type: (row.match_type as string | null) ?? null,
      match_status: (row.match_status as string | null) ?? null,
      club_name: matchClubNameByCourt.get(courtId) ?? "Club",
    };
  });

  const { data: reservationsRaw } = await supabase
    .from(DB_TABLES.matches)
    .select("id, scheduled_date, match_status, total_price, court_id")
    .eq("owner_id", user.id)
    .eq("match_type", "reservation")
    .order("scheduled_date", { ascending: false })
    .limit(20);

  const reservationCourtIds = [
    ...new Set((reservationsRaw ?? []).map((m: { court_id: string | null }) => m.court_id).filter(Boolean)),
  ];
  const { data: reservationCourts } =
    reservationCourtIds.length > 0
      ? await supabase
          .from(DB_TABLES.courts)
          .select("id, name")
          .in("id", reservationCourtIds as string[])
      : { data: [] };

  const reservationCourtNameById = new Map<string, string>();
  for (const row of reservationCourts ?? []) {
    const typed = row as { id: string; name: string | null };
    reservationCourtNameById.set(typed.id, typed.name ?? "Cancha");
  }

  const reservations: ReservationActivity[] = (reservationsRaw ?? []).map((row: Record<string, unknown>) => {
    const courtId = String(row.court_id ?? "");
    return {
      id: String(row.id ?? ""),
      scheduled_date: (row.scheduled_date as string | null) ?? null,
      match_status: (row.match_status as string | null) ?? null,
      total_price: (row.total_price as number | null) ?? null,
      court_name: reservationCourtNameById.get(courtId) ?? "Cancha",
    };
  });

  return <ActivityTabs matches={matches} reservations={reservations} />;
}
