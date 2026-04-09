import { notFound } from "next/navigation";
import ClubDetailClient from "./club-detail-client";
import { DB_TABLES } from "@/lib/db-tables";
import type { CourtRow, CourtScheduleRow } from "@/lib/database.types";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClubDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: club, error: clubError } = await supabase
    .from(DB_TABLES.clubs)
    .select("id,name,location")
    .eq("id", id)
    .maybeSingle();

  if (clubError || !club) {
    notFound();
  }

  const { data: courtsData } = await supabase
    .from(DB_TABLES.courts)
    .select("id,club_id,name,price")
    .eq("club_id", id)
    .order("name");

  const courts = (courtsData ?? []) as CourtRow[];
  const courtIds = courts.map((c) => c.id);

  const { data: schedulesData } = courtIds.length
    ? await supabase
        .from(DB_TABLES.courtSchedules)
        .select("court_id,day_of_week,open_time,close_time")
        .in("court_id", courtIds)
    : { data: [] as CourtScheduleRow[] };

  const schedules = (schedulesData ?? []) as CourtScheduleRow[];

  return (
    <ClubDetailClient club={club} courts={courts} schedules={schedules} />
  );
}
