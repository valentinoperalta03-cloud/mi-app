import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { MessageCircle, Send } from "lucide-react";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { MatchResultForm } from "@/components/match-result-form";
import { ProfileAvatar } from "@/components/profile-avatar";
import { formatDateInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { formatProfileNivelFromRow } from "@/lib/profile-display";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";
import InviteFriendsSection from "./invite-friends-section";
import PartidoEditSection from "./partido-edit-section";
import PrivateInviteBlock from "./private-invite-block";
import RequestJoinButton from "./request-join-button";
import VisibilityToggle from "./visibility-toggle";
import WhatsappShareButton from "./whatsapp-share-button";
import { acceptJoinRequest, rejectJoinRequest } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    edit_error?: string;
    invite?: string;
    join_sent?: string;
    join_error?: string;
    join_accepted?: string;
  }>;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: matchRow } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id,date,courts(name,clubs(name))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!matchRow) {
    return {};
  }
  const match = matchRow as unknown as {
    id: string;
    date: string;
    courts:
      | { name: string | null; clubs: { name: string | null } | { name: string | null }[] | null }
      | { name: string | null; clubs: { name: string | null } | { name: string | null }[] | null }[]
      | null;
  };
  const courtRel = Array.isArray(match.courts) ? match.courts[0] ?? null : match.courts;
  const clubRel = courtRel?.clubs;
  const clubObj = Array.isArray(clubRel) ? clubRel[0] ?? null : clubRel;
  const { count: participantsCount } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", id);
  const clubName = clubObj?.name ?? "Padelibre";
  const when = parseISO(match.date);
  const day = format(when, "EEEE d 'de' MMMM", { locale: es });
  const hour = format(when, "HH:mm", { locale: es });
  const faltan = Math.max(0, 4 - (participantsCount ?? 0));
  const title = `🎾 ¡Sumate al partido en ${clubName}!`;
  const description = `${day} a las ${hour} - Faltan ${faltan} jugadores.`;
  const imageUrl = `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://padelibre.app"}/logo.png`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, alt: "Padelibre" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

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
  nivel: "Tu nivel no es compatible con este partido.",
  genero_femenino: "Este partido es solo femenino.",
  genero_masculino: "Este partido es solo masculino.",
  db: "Ocurrió un error al guardar. Intentá de nuevo.",
  pago: "No se pudo iniciar el pago con Mercado Pago. Intentá de nuevo o contactá soporte.",
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
  level: number | null;
  technical_score: number | null;
};

export default async function PartidoDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const editErrorKey = sp.edit_error?.trim() ?? "";
  const editErrorMessage = editErrorKey ? EDIT_ERROR_MESSAGES[editErrorKey] ?? "No se pudo guardar la edición." : null;
  const joinSent = sp.join_sent === "1";
  const joinAccepted = sp.join_accepted === "1";
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
      "id,date,owner_id,scheduled_date,scheduled_time,payment_status,match_status,result_available_at,court_id,match_type,visibility,gender_category,level_restricted,duration_minutes,total_price,courts(name,clubs(name,location))"
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
    match_status: string | null;
    result_available_at?: string | null;
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

  // Check if result screen should be shown
  const now = new Date();
  const resultAvailableAt = match.result_available_at
    ? new Date(match.result_available_at)
    : null;
  const isResultAvailable = resultAvailableAt ? now >= resultAvailableAt : false;
  const isMatchFinished = match.match_status === "reserved" && isResultAvailable;

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
    .select("player_id, profiles(name,avatar_url,category,level,technical_score)")
    .eq("match_id", id);

  const participants = ((participantsRows ?? []) as Array<{
    player_id: string;
    profiles:
      | {
          name: string | null;
          avatar_url: string | null;
          category: string | null;
          level: number | null;
          technical_score: number | null;
        }
      | {
          name: string | null;
          avatar_url: string | null;
          category: string | null;
          level: number | null;
          technical_score: number | null;
        }[]
      | null;
  }>).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      player_id: row.player_id,
      name: profile?.name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      category: profile?.category ?? null,
      level: profile?.level ?? null,
      technical_score: profile?.technical_score ?? null,
    } satisfies ParticipantRow;
  });

  // Check if current user has paid
  const { data: myPayment } = await supabase
    .from(DB_TABLES.payments)
    .select("status,mp_preference_id")
    .eq("match_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const myPaymentStatus = (myPayment as { status?: string | null; mp_preference_id?: string | null } | null)?.status ?? "none";
  const myPrefId = String((myPayment as { mp_preference_id?: string | null } | null)?.mp_preference_id ?? "").trim();
  const hasPaid = myPaymentStatus === "approved";
  const hasPendingPayment =
    String(myPaymentStatus).toLowerCase() === "pending" && myPrefId.length > 0;
  const mercadoPagoPayHref = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${encodeURIComponent(myPrefId)}`;

  const isParticipant = participants.some((participant) => participant.player_id === user.id);
  const isOwner = Boolean(user.id && match.owner_id && user.id === match.owner_id);

  // Check if current user already submitted result
  const { data: myResult } = await supabase
    .from(DB_TABLES.matchResults)
    .select("id, status")
    .eq("match_id", id)
    .eq("proposed_by", user.id)
    .maybeSingle();

  const alreadySubmitted = Boolean(myResult);

  // Check how many of 4 players confirmed
  const { count: confirmCount } = await supabase
    .from(DB_TABLES.matchResultConfirmations)
    .select("id", { count: "exact", head: true })
    .eq("match_id", id);

  const { data: favoritesRows } = await supabase
    .from(DB_TABLES.userFavorites)
    .select("favorite_user_id")
    .eq("user_id", user.id);
  const favoriteIds = ((favoritesRows ?? []) as { favorite_user_id: string }[]).map((f) => f.favorite_user_id);

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
  const matchStatusNorm = String(match.match_status ?? "").toLowerCase();
  const canJoinAsNewPlayer =
    !isParticipant &&
    !isOwner &&
    freeSlots > 0 &&
    matchStatusNorm !== "full" &&
    matchStatusNorm !== "cancelled";
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
  const longDateArRaw = formatDateInArgentina(match.date, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const longDateAr = longDateArRaw.charAt(0).toUpperCase() + longDateArRaw.slice(1);
  const hourAr = formatDateInArgentina(match.date, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const partyUrl = siteOrigin ? `${siteOrigin}/partidos/${id}` : `https://padelibre.app/partidos/${id}`;
  const sharePath = partyUrl;
  const ownerWhatsMessage = `¡Hola! Ya reservé la cancha para nuestro partido en ${detail.club_name ?? "el club"}.
Día: ${longDateAr} a las ${hourAr}.
Link del partido: ${partyUrl}`;
  const ownerWhatsHref = `https://wa.me/?text=${encodeURIComponent(ownerWhatsMessage)}`;
  const assistWhatsMessage = `Hola, ya me sumé al partido del ${longDateAr}. ¡En un ratito te paso el comprobante!`;
  const assistWhatsHref = `https://wa.me/?text=${encodeURIComponent(assistWhatsMessage)}`;
  const ownerParticipant = participants.find((p) => p.player_id === (match.owner_id ?? ""));
  const ownerLevelLabel = formatProfileNivelFromRow(
    ownerParticipant ? { level: ownerParticipant.level } : null
  );
  const genderLabel =
    match.gender_category === "femenino"
      ? "Femenino"
      : match.gender_category === "masculino"
        ? "Masculino"
        : "Mixto";
  const slots = Array.from({ length: 4 }, (_, i) => {
    const p = participants[i];
    if (p) return `✅ ${p.name ?? "Jugador"} (${p.level ?? p.technical_score ?? "Sin nivel"})`;
    return "⚪ Falta 1 jugador";
  }).join("\n");

  const nivelText = match.level_restricted
    ? `restringido · ${ownerLevelLabel}`
    : "abierto a todos";

  const shareWhatsText = `🎾 ¿Quién se anima? PARTIDO EN ${(detail.club_name ?? "").toUpperCase()}

📅 ${longDateAr} · ${hourAr} · 90 min
⚧️ ${genderLabel}
📊 Nivel ${nivelText}

Jugadores:
${slots}

🔗 ${sharePath}

¡Sumate antes de que se llene! 🔥`;

  const participantIds = new Set(participants.map((p) => p.player_id));
  const pendingRequestIds = new Set(accessRequesterIds);
  const followingIds = ((favoritesRows ?? []) as { favorite_user_id: string }[]).map((f) => f.favorite_user_id);
  const { data: followedByRows } =
    isOwner && followingIds.length > 0
      ? await supabase
          .from(DB_TABLES.userFavorites)
          .select("user_id")
          .eq("favorite_user_id", user.id)
          .in("user_id", followingIds)
      : { data: [] };
  const mutualIds = ((followedByRows ?? []) as Array<{ user_id: string }>)
    .map((r) => r.user_id)
    .filter((friendId) => !participantIds.has(friendId) && !pendingRequestIds.has(friendId));
  const { data: mutualProfiles } =
    isOwner && mutualIds.length > 0
      ? await supabase
          .from(DB_TABLES.profiles)
          .select("user_id,name,technical_score")
          .in("user_id", mutualIds)
      : { data: [] };
  const inviteCandidates = ((mutualProfiles ?? []) as Array<{
    user_id: string;
    name: string | null;
    technical_score: number | null;
  }>).map((row) => ({
    user_id: row.user_id,
    name: row.name?.trim() || "Jugador",
    technical_score: row.technical_score ?? null,
  }));

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-2">
        <Link href="/buscar-partido" className="inline-block text-sm font-semibold text-[#0585FC] hover:text-[#0461C4]">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Detalle del partido</h1>
      </header>

      {isOwner ? (
        <section className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/95 to-white p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-slate-900/40">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">Tu partido</h2>
            <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white dark:bg-emerald-500">
              Organizás
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {participants.length}/4 jugadores confirmados
            {freeSlots > 0 ? ` · ${freeSlots} cupo${freeSlots === 1 ? "" : "s"} libre${freeSlots === 1 ? "" : "s"}` : ""}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={ownerWhatsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-center text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,133,252,0.35)] transition hover:brightness-95 active:scale-[0.99]"
              style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
            >
              <MessageCircle size={18} aria-hidden />
              Compartir por WhatsApp
            </a>
            {freeSlots > 0 ? (
              <Link
                href="#invitar-amigos"
                className="flex w-full items-center justify-center rounded-2xl border border-[#0585FC]/30 bg-white py-3 text-center text-sm font-semibold text-[#0461C4] transition hover:bg-[#0585FC]/5 dark:border-[#0585FC]/40 dark:bg-slate-800 dark:text-sky-300"
              >
                Invitar amigos
              </Link>
            ) : null}
            {(pendingRequestsCount ?? 0) > 0 ? (
              <Link
                href={`/partidos/${id}/solicitudes`}
                className="text-center text-sm font-semibold text-[#0461C4] underline-offset-2 hover:underline dark:text-sky-400"
              >
                Ver solicitudes ({pendingRequestsCount})
              </Link>
            ) : null}
            {isParticipant && hasPaid ? (
              <Link
                href={`/partidos/${id}/chat`}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#0585FC]/25 bg-[#0585FC]/5 py-3 text-center text-sm font-semibold text-[#0461C4] transition hover:bg-[#0585FC]/10 dark:text-sky-400"
              >
                <MessageCircle size={16} aria-hidden />
                Chat del partido
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <article className={`${PLAYER_CARD_INTERACTIVE} rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">{detail.club_name ?? "Club"}</h2>
          {isPrivate ? (
            <span className="rounded-full border border-[#0585FC]/20 bg-[#0585FC]/5 px-3 py-1 text-xs font-semibold text-[#0585FC]">
              Privado
            </span>
          ) : null}
        </div>
        <p className="text-sm text-slate-500">{detail.club_location ?? "Ubicación pendiente"}</p>
        <p className="mt-1 text-sm text-slate-600">Cancha: {detail.court_name ?? "Cancha"}</p>
        {isOwner ? (
          <VisibilityToggle matchId={id} initialVisibility={detail.visibility === "privado" ? "privado" : "publico"} />
        ) : null}

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
            <dd className="text-right text-sm text-[var(--text-tertiary)]">
              <span className="text-lg font-bold text-[#0461C4]">${detail.total_price ?? 0}</span>
              <span> · Precio total del turno</span>
            </dd>
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

      {joinAccepted && isOwner ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          El jugador será redirigido al pago para confirmar su lugar (recibirá un aviso con el link).
        </p>
      ) : null}

      {joinErrorKey === "nivel" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3">
          <p className="font-semibold text-amber-800 dark:text-amber-300">
            Tu nivel no es compatible con este partido
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Podés enviar una solicitud especial. Los jugadores del partido votarán si te aceptan.
          </p>
          <RequestJoinButton matchId={id} levelOverride={true} submitLabel="Solicitar revisión" />
        </div>
      ) : null}

      {isOwner && isPrivate ? <PrivateInviteBlock inviteUrl={inviteUrl} /> : null}

      {isPrivate && !isOwner && !isParticipant && inviteOpen ? (
        <section className="rounded-2xl border border-[#0585FC]/20/80 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Unirte al partido</h2>
          <p className="mt-2 text-sm text-slate-600">
            Este partido es privado. Enviá una solicitud al creador para sumarte.
          </p>
          <div className="mt-4">
            {hasPendingAccessRequest ? (
              <p className="rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 px-4 py-3 text-sm font-medium text-[#0585FC]">
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
                        className="btn-primary-gradient w-full rounded-2xl px-4 py-2.5 text-sm font-semibold transition hover:brightness-95 sm:w-auto"
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

      {isParticipant && !isOwner && payStatus !== "paid" ? (
        <section className={`${PLAYER_CARD_INTERACTIVE} rounded-2xl border border-emerald-200/70 bg-white p-4 shadow-sm`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="relative h-5 w-16 overflow-hidden opacity-60">
              <Image src="/logo.png" alt="Padelibre" fill className="object-contain" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones por WhatsApp</p>
          </div>
          <a
            href={assistWhatsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 active:scale-[0.98]"
          >
            <Send size={16} aria-hidden />
            Confirmar asistencia
          </a>
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

        {freeSlots > 0 && !isOwner ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#0585FC]/20/70 bg-[#0585FC]/5/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="relative h-7 w-20 overflow-hidden rounded-xl border border-slate-200/70 bg-white/90">
                <Image src="/logo.png" alt="Logo de Padelibre" fill className="object-contain p-1" />
              </div>
              <p className="text-xs font-medium text-slate-600">Invitá jugadores y completa el partido.</p>
            </div>
            <WhatsappShareButton fallbackPath={partyUrl} sharePath={partyUrl} shareText={shareWhatsText} />
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

      {isOwner && freeSlots > 0 ? (
        <InviteFriendsSection matchId={id} friends={inviteCandidates} sectionId="invitar-amigos" />
      ) : null}

      {isMatchFinished && isParticipant ? (
        <section className="space-y-3">
          <div
            className="rounded-2xl p-4 text-center"
            style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
          >
            <p className="text-white font-bold text-lg">🏆 ¡El partido terminó!</p>
            <p className="text-white/80 text-sm mt-1">
              {alreadySubmitted
                ? `Esperando que los otros jugadores confirmen (${confirmCount ?? 0}/4)`
                : "Es hora de cargar el resultado"}
            </p>
          </div>

          {!alreadySubmitted ? (
            <MatchResultForm
              matchId={id}
              teamALabel="Tu dupla"
              teamBLabel="Dupla rival"
              lockedByTeammate={false}
              alreadyStarted={false}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-bold text-emerald-800 dark:text-emerald-300">
                    Resultado enviado
                  </p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    Esperando que los {4 - (confirmCount ?? 0)} jugadores restantes confirmen
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all ${
                      i < (confirmCount ?? 0)
                        ? "bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.4)]"
                        : "bg-emerald-100 text-emerald-300 dark:bg-emerald-900/30"
                    }`}
                  >
                    {i < (confirmCount ?? 0) ? "✓" : i + 1}
                  </motion.div>
                ))}
              </div>

              <p className="text-center text-xs text-emerald-600 dark:text-emerald-500">
                {confirmCount ?? 0} de 4 jugadores confirmaron
              </p>
            </motion.div>
          )}
        </section>
      ) : null}

      {!isMatchFinished && isParticipant && resultAvailableAt && now < resultAvailableAt ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            ⏱ El resultado estará disponible después del partido
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {resultAvailableAt.toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            hs
          </p>
        </div>
      ) : null}

      {hasPendingPayment ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
            <p className="font-semibold text-amber-800 dark:text-amber-300">Tenés un pago pendiente para confirmar tu lugar</p>
          </div>
          <a
            href={mercadoPagoPayHref}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-2xl py-3 text-center text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
            style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
          >
            Pagar ahora
          </a>
        </div>
      ) : null}

      {isParticipant && !isOwner && hasPaid && !isMatchFinished ? (
        <section className="space-y-3 rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/50 dark:bg-slate-900/40">
          <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200">
            Estás anotado ✓
          </span>
          <Link
            href={`/partidos/${id}/chat`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-center text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)] transition hover:brightness-95 active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
          >
            <MessageCircle size={18} aria-hidden />
            Chat del partido
          </Link>
          <div className="flex w-full justify-center">
            <WhatsappShareButton fallbackPath={partyUrl} sharePath={partyUrl} shareText={shareWhatsText} />
          </div>
          {(pendingRequestsCount ?? 0) > 0 ? (
            <Link
              href={`/partidos/${id}/solicitudes`}
              className="block w-full rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 px-4 py-3 text-center text-sm font-semibold text-[#0461C4] transition hover:bg-[#0585FC]/10"
            >
              Ver solicitudes ({pendingRequestsCount})
            </Link>
          ) : null}
        </section>
      ) : null}

      {canJoinAsNewPlayer && !isMatchFinished && !isPrivate && !match.level_restricted ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <h2 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">Sumate al partido</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Confirmás tu lugar con el pago del turno.</p>
          <div className="mt-4">
            <RequestJoinButton matchId={id} submitLabel="Pagar y unirme" />
          </div>
        </section>
      ) : null}

      {canJoinAsNewPlayer && !isMatchFinished && match.level_restricted && !isOwner ? (
        <div className="space-y-2">
          <Link
            href={`/partidos/${id}/chat`}
            className="block w-full rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 px-4 py-3 text-center text-sm font-semibold text-[#0585FC]"
          >
            Ver chat del partido
          </Link>
          <RequestJoinButton matchId={id} submitLabel="Pagar y unirme" />
        </div>
      ) : null}

      <Link
        href="/buscar-partido"
        className="block w-full py-2 text-center text-sm font-semibold text-[#0585FC] transition hover:text-[#0461C4]"
      >
        ← Volver al buscador
      </Link>
    </MotionPage>
  );
}
