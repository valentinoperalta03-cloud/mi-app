import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DB_TABLES } from "@/lib/db-tables";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";
import PartidoEditSection from "./partido-edit-section";
import PrivateInviteBlock from "./private-invite-block";
import RequestJoinButton from "./request-join-button";
import WhatsappShareButton from "./whatsapp-share-button";
import { acceptJoinRequest, rejectJoinRequest } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ edit_error?: string; invite?: string; join_sent?: string; join_error?: string }>;
};

const EDIT_ERROR_MESSAGES: Record<string, string> = {
  datos: "Faltan datos para guardar los cambios.",
  duracion: "Duración del turno inválida.",
  permiso: "No tenés permiso para editar este partido.",
  pagado: "No podés editar un partido con jugadores que ya pagaron.",
  fecha: "No se encontró la fecha del partido.",
  ocupado: "Ese horario ya está ocupado. Elegí otro.",
  db: "No se pudieron guardar los cambios. Intentá de nuevo.",
};

const JOIN_FLASH_MESSAGES: Record<string, string> = {
  sent: "Solicitud enviada. El creador del partido podrá aceptarte desde el detalle del partido.",
  error: "No se pudo enviar la solicitud. Intentá de nuevo.",
  permiso: "No tenés permiso para esa acción.",
  cupos: "El partido ya está completo.",
  db: "Ocurrió un error al guardar. Intentá de nuevo.",
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

export default async function PartidoDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const editErrorKey = sp.edit_error?.trim() ?? "";
  const editErrorMessage = editErrorKey ? EDIT_ERROR_MESSAGES[editErrorKey] ?? "No se pudo guardar la edición." : null;
  const joinSent = sp.join_sent === "1";
  const joinErrorKey = sp.join_error?.trim() ?? "";
  const joinFlashMessage = joinSent
    ? JOIN_FLASH_MESSAGES.sent
    : joinErrorKey
      ? JOIN_FLASH_MESSAGES[joinErrorKey] ?? JOIN_FLASH_MESSAGES.error
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: matchRow, error: matchError } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id,date,owner_id,scheduled_date,scheduled_time,payment_status,court_id,match_type,visibility,gender_category,level_restricted,duration_minutes,total_price,courts(name,clubs(name,location))"
    )
    .eq("id", id)
    .maybeSingle();

  if (matchError || !matchRow) {
    redirect("/buscar-partido");
  }

  const match = matchRow as unknown as {
    id: string;
    date: string;
    owner_id: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    payment_status: string | null;
    court_id: string;
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

  if (!match.court_id?.trim()) {
    redirect("/buscar-partido");
  }

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
  const isOwner = Boolean(user.id && match.owner_id && user.id === match.owner_id);

  const { data: favoritesRows } = await supabase
    .from(DB_TABLES.userFavorites)
    .select("favorite_id")
    .eq("user_id", user.id);
  const favoriteIds = ((favoritesRows ?? []) as { favorite_id: string }[]).map((f) => f.favorite_id);

  const isPrivate = String(match.visibility ?? "").toLowerCase() === "privado";
  const inviteOpen = sp.invite === "true";
  const ownerId = match.owner_id ?? "";
  const isFriendOfOwner = Boolean(ownerId && favoriteIds.includes(ownerId));

  const canAccessPrivate =
    !isPrivate || isOwner || isParticipant || isFriendOfOwner || inviteOpen;

  if (isPrivate && !canAccessPrivate) {
    redirect("/buscar-partido");
  }

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const inviteUrl = siteOrigin ? `${siteOrigin}/partidos/${id}?invite=true` : `/partidos/${id}?invite=true`;
  const sharePath = siteOrigin ? `${siteOrigin}/partidos/${id}` : `/partidos/${id}`;

  const { data: myPendingAccess } =
    isPrivate && !isOwner && !isParticipant && inviteOpen
      ? await supabase
          .from(DB_TABLES.matchJoinRequests)
          .select("id")
          .eq("match_id", id)
          .eq("player_id", user.id)
          .eq("status", "pending")
          .maybeSingle()
      : { data: null };

  const hasPendingAccessRequest = Boolean(myPendingAccess);

  const { data: accessRequestRows } = isOwner
    ? await supabase
        .from(DB_TABLES.matchJoinRequests)
        .select("id,player_id,created_at")
        .eq("match_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
    : { data: [] };

  const accessRequests = (accessRequestRows ?? []) as Array<{
    id: string;
    player_id: string;
    created_at: string;
  }>;
  const accessRequesterIds = [...new Set(accessRequests.map((r) => r.player_id))];
  const { data: accessProfilesData } =
    accessRequesterIds.length > 0
      ? await supabase
          .from(DB_TABLES.profiles)
          .select("user_id,name,category,avatar_url")
          .in("user_id", accessRequesterIds)
      : { data: [] };
  const accessProfileMap = new Map(
    ((accessProfilesData ?? []) as Array<{
      user_id: string;
      name: string | null;
      category: string | null;
      avatar_url: string | null;
    }>).map((p) => [p.user_id, p])
  );

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

  const payStatus = String(match.payment_status ?? "").toLowerCase();
  const canEdit = !(payStatus === "paid" && participants.length > 1);
  const blockedEditMessage =
    "No podés editar un partido con jugadores que ya pagaron.";

  const scheduledDateStr =
    match.scheduled_date && String(match.scheduled_date).trim().length >= 10
      ? String(match.scheduled_date).trim().slice(0, 10)
      : format(parseISO(match.date), "yyyy-MM-dd");
  const scheduledTimeStr =
    match.scheduled_time != null && String(match.scheduled_time).trim() !== ""
      ? String(match.scheduled_time).trim().slice(0, 5)
      : format(parseISO(match.date), "HH:mm");

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-2">
        <Link href="/buscar-partido" className="inline-block text-sm font-semibold text-sky-600 hover:text-sky-700">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Detalle del partido</h1>
      </header>

      <article className={`${PLAYER_CARD_INTERACTIVE} rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">{detail.club_name ?? "Club"}</h2>
          {isPrivate ? (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
              Privado
            </span>
          ) : null}
        </div>
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

      {editErrorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {editErrorMessage}
        </p>
      ) : null}

      {joinFlashMessage ? (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            joinSent
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {joinFlashMessage}
        </p>
      ) : null}

      {isOwner && isPrivate ? <PrivateInviteBlock inviteUrl={inviteUrl} /> : null}

      {isPrivate && !isOwner && !isParticipant && inviteOpen ? (
        <section className="rounded-2xl border border-sky-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Unirte al partido</h2>
          <p className="mt-2 text-sm text-slate-600">
            Este partido es privado. Enviá una solicitud al creador para sumarte.
          </p>
          <div className="mt-4">
            {hasPendingAccessRequest ? (
              <p className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">
                Ya enviaste una solicitud pendiente.
              </p>
            ) : (
              <RequestJoinButton matchId={id} />
            )}
          </div>
        </section>
      ) : null}

      {isOwner && accessRequests.length > 0 ? (
        <section className={`${PLAYER_CARD_INTERACTIVE} rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm`}>
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Solicitudes de acceso</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Jugadores que pidieron unirse a tu partido privado.
          </p>
          <ul className="mt-4 space-y-3">
            {accessRequests.map((req) => {
              const prof = accessProfileMap.get(req.player_id);
              const name = prof?.name?.trim() || "Jugador";
              return (
                <li
                  key={req.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <ProfileAvatar avatarUrl={prof?.avatar_url ?? null} name={name} size={40} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{name}</p>
                      <p className="text-xs text-slate-600">Nivel: {prof?.category?.trim() || "Sin nivel"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form action={acceptJoinRequest} className="flex-1 sm:flex-initial">
                      <input type="hidden" name="request_id" value={req.id} />
                      <input type="hidden" name="match_id" value={id} />
                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 sm:w-auto"
                      >
                        Aceptar
                      </button>
                    </form>
                    <form action={rejectJoinRequest} className="flex-1 sm:flex-initial">
                      <input type="hidden" name="request_id" value={req.id} />
                      <input type="hidden" name="match_id" value={id} />
                      <button
                        type="submit"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                      >
                        Rechazar
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <PartidoEditSection
        isOwner={isOwner}
        canEdit={canEdit}
        blockedMessage={blockedEditMessage}
        formProps={{
          matchId: id,
          courtId: match.court_id,
          initialData: {
            match_type: match.match_type ?? "amistoso",
            visibility: match.visibility ?? "publico",
            gender_category: match.gender_category ?? "mixto",
            level_restricted: Boolean(match.level_restricted),
            scheduled_date: scheduledDateStr,
            scheduled_time: scheduledTimeStr,
            court_id: match.court_id,
            duration_minutes: match.duration_minutes && match.duration_minutes > 0 ? match.duration_minutes : 90,
          },
        }}
      />

      <section className={`${PLAYER_CARD_INTERACTIVE} rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Jugadores anotados</h2>
          <span className="text-xs font-medium text-slate-500">
            {freeSlots} cupo{freeSlots === 1 ? "" : "s"} libre{freeSlots === 1 ? "" : "s"} de 4
          </span>
        </div>

        {freeSlots > 0 ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-sky-200/70 bg-sky-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="relative h-7 w-20 overflow-hidden rounded-xl border border-slate-200/70 bg-white/90">
                <Image src="/logo-marca.png" alt="Logo de Padelibre" fill className="object-contain p-1" />
              </div>
              <p className="text-xs font-medium text-slate-600">Invitá jugadores y completa el partido.</p>
            </div>
            <WhatsappShareButton fallbackPath={sharePath} />
          </div>
        ) : null}

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
