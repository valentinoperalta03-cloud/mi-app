import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { PlayerStackHeader } from "@/components/player-back-button";
import { DB_TABLES } from "@/lib/db-tables";
import { getUserLocationServer } from "@/lib/locations-server";
import { isOnboardingComplete } from "@/lib/onboarding-check";
import { createClient } from "@/utils/supabase/server";
import CrearPartidoForm, {
  type ClubOption,
  type CourtOption,
  type FriendOption,
  type GenderCategory,
  type SlotPriceOption,
} from "./crear-partido-form";

type PageProps = {
  searchParams?: Promise<{ clubId?: string }>;
};

export default async function CrearPartidoPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const defaultClubId = sp.clubId?.trim() || undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const onboardingDone = await isOnboardingComplete(supabase, user.id);
  if (!onboardingDone) {
    redirect("/onboarding");
  }
  const { data: profile } = user
    ? await supabase.from(DB_TABLES.profiles).select("gender").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const profileGender = (profile as { gender?: string | null } | null)?.gender ?? null;
  const defaultGender: GenderCategory =
    profileGender === "femenino" ? "femenino" : profileGender === "masculino" ? "masculino" : "mixto";

  const userLocation = await getUserLocationServer();

  const [
    { data: clubsRaw, error: clubsError },
    { data: courtsRaw, error: courtsError },
    { data: slotPricesRaw },
    { data: availabilityRaw },
    { data: mpConnectedRaw },
  ] = await Promise.all([
    supabase
      .from(DB_TABLES.clubs)
      .select(
        "id, name, location, city, province, description, image_url, cover_image_url, logo_url, accepts_cash, accepts_transfer, bank_alias, bank_cbu, open_time, deposit_type, deposit_value"
      )
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from(DB_TABLES.courts)
      .select("id, club_id, name, price")
      .order("name", { ascending: true }),
    supabase
      .from(DB_TABLES.courtSchedules)
      .select("court_id,start_time,price_override")
      .is("day_of_week", null)
      .not("start_time", "is", null)
      .not("price_override", "is", null),
    supabase.rpc("get_clubs_availability"),
    // mp_access_token esta revocada para anon/authenticated: se pregunta via RPC
    // que solo expone el booleano de conexion, nunca el token.
    supabase.rpc("get_clubs_mp_connected"),
  ]);

  const mpConnectedMap = Object.fromEntries(
    ((mpConnectedRaw ?? []) as Array<{ club_id: string; mp_connected: boolean }>).map((m) => [
      m.club_id,
      m.mp_connected,
    ])
  );

  const availabilityMap = Object.fromEntries(
    ((availabilityRaw ?? []) as Array<{ club_id: string; is_available: boolean }>).map((a) => [
      a.club_id,
      a.is_available,
    ])
  );

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
    city?: string | null;
    province?: string | null;
    description?: string | null;
    image_url?: string | null;
    cover_image_url?: string | null;
    logo_url?: string | null;
    accepts_cash?: boolean | null;
    accepts_transfer?: boolean | null;
    bank_alias?: string | null;
    bank_cbu?: string | null;
    open_time?: string | null;
    deposit_type?: "percentage" | "fixed" | null;
    deposit_value?: number | null;
  }>).map((club) => ({
    id: club.id,
    name: club.name ?? "Club sin nombre",
    location: club.location ?? "",
    city: club.city ?? null,
    province: club.province ?? null,
    description: club.description ?? null,
    imageUrl: club.image_url ?? null,
    coverImageUrl: club.cover_image_url ?? null,
    logoUrl: club.logo_url ?? null,
    acceptsCash: Boolean(club.accepts_cash),
    acceptsTransfer: Boolean(club.accepts_transfer),
    bankAlias: club.bank_alias?.trim() || null,
    bankCbu: club.bank_cbu?.trim() || null,
    mpConnected: mpConnectedMap[club.id] ?? false,
    openTime: String(club.open_time ?? "09:00").trim().slice(0, 5) || "09:00",
    depositType: club.deposit_type ?? null,
    depositValue: Number(club.deposit_value ?? 0),
    isAvailable: availabilityMap[club.id] ?? true,
  }));
  const courtsDeduped = Array.from(
    new Map(
      (
        (courtsRaw ?? []) as Array<{
          id: string;
          club_id: string;
          name: string | null;
          price: number | null;
        }>
      ).map((row) => [row.id, row])
    ).values()
  );
  const courts: CourtOption[] = courtsDeduped.map((court) => ({
    id: court.id,
    clubId: court.club_id,
    name: court.name ?? "Cancha",
    price: court.price ?? 0,
  }));
  const slotPrices: SlotPriceOption[] = ((slotPricesRaw ?? []) as Array<{
    court_id: string;
    start_time: string | null;
    price_override: number | null;
  }>)
    .filter((row) => row.start_time && row.price_override != null)
    .map((row) => ({
      courtId: row.court_id,
      startTime: String(row.start_time).slice(0, 5),
      price: Number(row.price_override ?? 0),
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
      <div className="mb-2">
        <PlayerStackHeader
          backHref="/home"
          backLabel="Volver al inicio"
          title="Crear partido"
          subtitle="Reservá tu cancha en pocos pasos y publicá el partido para la comunidad."
          className="mb-0"
        />
      </div>

      {clubsError || courtsError ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          No se pudo cargar la disponibilidad de clubes y canchas.
        </section>
      ) : (
        <CrearPartidoForm
          clubs={clubs}
          courts={courts}
          slotPrices={slotPrices}
          defaultGender={defaultGender}
          friends={friends}
          defaultClubId={defaultClubId}
          userCity={userLocation.city}
          userProvince={userLocation.province}
        />
      )}
    </MotionPage>
  );
}
