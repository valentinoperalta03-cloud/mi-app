import Link from "next/link";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import CrearPartidoForm, {
  type ClubOption,
  type CourtOption,
  type FriendOption,
  type GenderCategory,
} from "./crear-partido-form";

export default async function CrearPartidoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from(DB_TABLES.profiles).select("gender").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const profileGender = (profile as { gender?: string | null } | null)?.gender ?? null;
  const defaultGender: GenderCategory =
    profileGender === "femenino" ? "femenino" : profileGender === "masculino" ? "masculino" : "mixto";

  const [{ data: clubsRaw, error: clubsError }, { data: courtsRaw, error: courtsError }] = await Promise.all([
    supabase
      .from(DB_TABLES.clubs)
      .select("id, name, location, description, image_url")
      .order("name", { ascending: true }),
    supabase.from(DB_TABLES.courts).select("id, club_id, name, price").order("name", { ascending: true }),
  ]);

  const { data: favoritesRaw } = user
    ? await supabase
        .from(DB_TABLES.userFavorites)
        .select("favorite_user_id")
        .eq("user_id", user.id)
    : { data: [] };
  const favoriteIds = (favoritesRaw ?? []).map((row: { favorite_user_id: string }) => row.favorite_user_id);
  const { data: friendProfilesRaw } = favoriteIds.length
    ? await supabase
        .from(DB_TABLES.profiles)
        .select("user_id, name, avatar_url, level, level_of_play, technical_score")
        .in("user_id", favoriteIds)
    : { data: [] };

  const clubs: ClubOption[] = ((clubsRaw ?? []) as Array<{
    id: string;
    name: string | null;
    location: string | null;
    description?: string | null;
    image_url?: string | null;
  }>).map((club) => ({
    id: club.id,
    name: club.name ?? "Club sin nombre",
    location: club.location ?? "",
    description: club.description ?? null,
    imageUrl: club.image_url ?? null,
  }));
  const courts: CourtOption[] = ((courtsRaw ?? []) as Array<{
    id: string;
    club_id: string;
    name: string | null;
    price: number | null;
  }>).map((court) => ({
    id: court.id,
    clubId: court.club_id,
    name: court.name ?? "Cancha",
    price: court.price ?? 0,
  }));
  const friends: FriendOption[] = ((friendProfilesRaw ?? []) as Array<{
    user_id: string;
    name: string | null;
    avatar_url: string | null;
    level?: number | null;
    level_of_play?: string | null;
    technical_score?: number | null;
  }>).map((friend) => ({
    userId: friend.user_id,
    name: friend.name?.trim() || "Jugador",
    avatarUrl: friend.avatar_url ?? null,
    level: friend.level ?? null,
    levelOfPlay: friend.level_of_play ?? null,
    technicalScore: friend.technical_score ?? null,
  }));

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-[var(--bg-app)] px-4 pb-24 pt-6">
      <header className="space-y-2">
        <Link href="/home" className="inline-block text-sm font-semibold text-[#0585FC] hover:text-[#0461C4]">
          ← Volver al inicio
        </Link>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">Crear partido</h1>
        <p className="text-sm text-slate-500">
          Reserva tu cancha en pocos pasos y publica el partido para la comunidad.
        </p>
      </header>

      {clubsError || courtsError ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          No se pudo cargar la disponibilidad de clubes y canchas.
        </section>
      ) : (
        <CrearPartidoForm clubs={clubs} courts={courts} defaultGender={defaultGender} friends={friends} />
      )}
    </MotionPage>
  );
}
