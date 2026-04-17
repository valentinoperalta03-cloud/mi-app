import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DB_TABLES } from "@/lib/db-tables";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

type MatchDetailRow = {
  id: string;
  date: string;
  match_type: string | null;
  visibility: "publico" | "privado" | null;
  gender_category: "masculino" | "femenino" | "mixto" | null;
  level_restricted: boolean | null;
  duration_minutes: number | null;
  total_price: number | null;
  court_name: string | null;
  club_name: string | null;
  club_location: string | null;
};

type ParticipantRow = {
  player_id: string;
  name: string | null;
  avatar_url: string | null;
  category: string | null;
};

export default async function PartidoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: matchRow, error: matchError } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id,date,match_type,visibility,gender_category,level_restricted,duration_minutes,total_price,courts(name,clubs(name,location))"
    )
    .eq("id", id)
    .maybeSingle();

  if (matchError || !matchRow) {
    redirect("/buscar-partido");
  }

  const match = matchRow as unknown as {
    id: string;
    date: string;
    match_type: string | null;
    visibility: "publico" | "privado" | null;
    gender_category: "masculino" | "femenino" | "mixto" | null;
    level_restricted: boolean | null;
    duration_minutes: number | null;
    total_price: number | null;
    courts:
      | {
          name: string | null;
          clubs:
            | {
                name: string | null;
                location: string | null;
              }
            | null;
        }
      | null;
  };

  const detail: MatchDetailRow = {
    id: match.id,
    date: match.date,
    match_type: match.match_type,
    visibility: match.visibility,
    gender_category: match.gender_category,
    level_restricted: match.level_restricted,
    duration_minutes: match.duration_minutes,
    total_price: match.total_price,
    court_name: match.courts?.name ?? null,
    club_name: match.courts?.clubs?.name ?? null,
    club_location: match.courts?.clubs?.location ?? null,
  };

  const { data: participantsRows } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id, profiles(name,avatar_url,category)")
    .eq("match_id", id);

  const participants = ((participantsRows ?? []) as Array<{
    player_id: string;
    profiles:
      | {
          name: string | null;
          avatar_url: string | null;
          category: string | null;
        }
      | {
          name: string | null;
          avatar_url: string | null;
          category: string | null;
        }[]
      | null;
  }>).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      player_id: row.player_id,
      name: profile?.name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      category: profile?.category ?? null,
    } satisfies ParticipantRow;
  });

  const isParticipant = participants.some((participant) => participant.player_id === user.id);
  const { count: pendingRequestsCount } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .select("id", { count: "exact", head: true })
    .eq("match_id", id)
    .eq("status", "pending");

  const when = format(parseISO(detail.date), "EEEE d 'de' MMMM '·' HH:mm", { locale: es });
  const freeSlots = Math.max(0, 4 - participants.length);
  const typeLabel = detail.match_type === "competitivo" ? "Competitivo" : "Amistoso";
  const visibilityLabel = detail.visibility === "privado" ? "Privado" : "Público";
  const categoryLabel =
    detail.gender_category === "masculino"
      ? "Masculino"
      : detail.gender_category === "femenino"
        ? "Femenino"
        : "Mixto";
  const levelLabel = detail.level_restricted ? "Mi nivel ±1" : "Cualquier nivel";

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-2">
        <Link href="/buscar-partido" className="inline-block text-sm font-semibold text-sky-600 hover:text-sky-700">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Detalle del partido</h1>
      </header>

      <article className={`${PLAYER_CARD_INTERACTIVE} rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm`}>
        <h2 className="text-xl font-bold tracking-tight text-slate-950">{detail.club_name ?? "Club"}</h2>
        <p className="text-sm text-slate-500">{detail.club_location ?? "Ubicación pendiente"}</p>
        <p className="mt-1 text-sm text-slate-600">Cancha: {detail.court_name ?? "Cancha"}</p>

        <dl className="mt-4 space-y-2 text-sm text-slate-600">
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-slate-500">Fecha y hora</dt>
            <dd className="text-right font-semibold text-slate-900">{when}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-slate-500">Tipo</dt>
            <dd className="font-semibold text-slate-900">{typeLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-slate-500">Visibilidad</dt>
            <dd className="font-semibold text-slate-900">{visibilityLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-slate-500">Categoría</dt>
            <dd className="font-semibold text-slate-900">{categoryLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-slate-500">Nivel</dt>
            <dd className="font-semibold text-slate-900">{levelLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-slate-500">Duración</dt>
            <dd className="font-semibold text-slate-900">{detail.duration_minutes ?? 0} min</dd>
          </div>
          <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
            <dt className="font-medium text-slate-500">Precio</dt>
            <dd className="text-lg font-bold text-sky-700">${detail.total_price ?? 0}</dd>
          </div>
        </dl>
      </article>

      <section className={`${PLAYER_CARD_INTERACTIVE} rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Jugadores anotados</h2>
          <span className="text-xs font-medium text-slate-500">
            {freeSlots} cupo{freeSlots === 1 ? "" : "s"} libre{freeSlots === 1 ? "" : "s"} de 4
          </span>
        </div>

        {participants.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Aún no hay jugadores anotados.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {participants.map((participant) => {
              const name = participant.name?.trim() || "Jugador";
              return (
                <li key={participant.player_id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <ProfileAvatar avatarUrl={participant.avatar_url} name={name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                    <p className="text-xs text-slate-500">Nivel: {participant.category?.trim() || "Sin nivel"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isParticipant && (pendingRequestsCount ?? 0) > 0 ? (
        <Link
          href={`/partidos/${id}/solicitudes`}
          className="block w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
        >
          Ver solicitudes ({pendingRequestsCount})
        </Link>
      ) : null}

      <Link
        href="/buscar-partido"
        className="block w-full rounded-2xl bg-sky-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-sky-500"
      >
        Volver
      </Link>
    </MotionPage>
  );
}
