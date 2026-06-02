import Link from "next/link";
import type { Metadata } from "next";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import { MessageCircle, User } from "lucide-react";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ConfirmTransferWhatsappButton } from "@/components/confirm-transfer-whatsapp-button";
import { MatchResultForm } from "@/components/match-result-form";
import { ProfileAvatar } from "@/components/profile-avatar";
import { formatDateInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { isMatchPrivate } from "@/lib/match-visibility";
import { isOnboardingComplete } from "@/lib/onboarding-check";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { PLAYER_CARD_INTERACTIVE } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";
import JoinWithTeamForm from "./join-with-team-form";
import PartidoEditSection from "./partido-edit-section";
import RequestJoinButton from "./request-join-button";
import WhatsappShareButton from "./whatsapp-share-button";
import { MatchStatusBanner } from "@/components/match-status-banner";
import { JoinMatchPaymentModal } from "../../../../components/join-match-payment-modal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CANCEL_ERROR_MESSAGES, EDIT_ERROR_MESSAGES, JOIN_FLASH_MESSAGES } from "@/lib/messages";
import { PAYMENT_COPY } from "@/lib/payment-copy";
import {
  acceptJoinRequest,
  cancelParticipation,
  regenerarLinkPago,
  rejectJoinRequest,
  requestToJoin,
} from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    edit_error?: string;
    invite?: string;
    join_sent?: string;
    join_error?: string;
    join_accepted?: string;
    cancel_ok?: string;
    cancel_error?: string;
    pay_regen_error?: string;
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
  team: number | null;
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
  const cancelOk = sp.cancel_ok === "1";
  const cancelErrorKey = sp.cancel_error?.trim() ?? "";
  const cancelErrorMessage = cancelErrorKey
    ? CANCEL_ERROR_MESSAGES[cancelErrorKey] ?? "No se pudo cancelar tu lugar."
    : null;
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
  const onboardingComplete = await isOnboardingComplete(supabase, user.id);
  const { data: userProfileData } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();
  const userName = (userProfileData as { name?: string | null } | null)?.name?.trim() || "un jugador";

  const { data: matchRow, error: matchError } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id,date,owner_id,scheduled_date,scheduled_time,payment_status,match_status,result_available_at,court_id,match_type,visibility,gender_category,level_restricted,duration_minutes,total_price,es_turno_fijo,courts(name,clubs(name,location))"
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
    es_turno_fijo: boolean | null;
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
    .select("player_id, team, profiles(name,avatar_url,category,level,technical_score)")
    .eq("match_id", id);

  const participants = ((participantsRows ?? []) as Array<{
    player_id: string;
    team: number | null;
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
      team: row.team ?? null,
      name: profile?.name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      category: profile?.category ?? null,
      level: profile?.level ?? null,
      technical_score: profile?.technical_score ?? null,
    } satisfies ParticipantRow;
  });

  const { data: courtForClub } = await supabase
    .from(DB_TABLES.courts)
    .select("club_id")
    .eq("id", match.court_id)
    .maybeSingle();

  const clubIdForPayment = (courtForClub as { club_id?: string | null } | null)?.club_id ?? "";

  const { data: clubPaymentData } = clubIdForPayment
    ? await supabase
        .from(DB_TABLES.clubs)
        .select("accepts_cash, accepts_transfer, mp_access_token, bank_alias, bank_cbu, whatsapp")
        .eq("id", clubIdForPayment)
        .maybeSingle()
    : { data: null };

  const clubPayment = clubPaymentData as {
    accepts_cash?: boolean | null;
    accepts_transfer?: boolean | null;
    mp_access_token?: string | null;
    bank_alias?: string | null;
    bank_cbu?: string | null;
    whatsapp?: string | null;
  } | null;

  const clubHasMp = Boolean(clubPayment?.mp_access_token?.trim());
  const clubAcceptsCash = Boolean(clubPayment?.accepts_cash);
  const clubAcceptsTransfer = Boolean(clubPayment?.accepts_transfer);
  const bankAlias = clubPayment?.bank_alias?.trim() ?? null;
  const bankCbu = clubPayment?.bank_cbu?.trim() ?? null;
  const clubWhatsapp = clubPayment?.whatsapp?.trim() ?? null;

  const team1Players = participants.filter((p) => p.team === 1);
  const team2Players = participants.filter((p) => p.team === 2);
  const team1Count = team1Players.length;
  const team2Count = team2Players.length;
  const resultTeam1Label =
    team1Players.map((p) => p.name?.trim() || "Jugador").join(" · ") || "Equipo 1";
  const resultTeam2Label =
    team2Players.map((p) => p.name?.trim() || "Jugador").join(" · ") || "Equipo 2";

  // Check if current user has paid
  const { data: myPayment } = await supabase
    .from(DB_TABLES.payments)
    .select("id,status,mp_preference_id,payment_method,updated_at")
    .eq("match_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const myPaymentStatus = String(
    (myPayment as { status?: string | null; mp_preference_id?: string | null } | null)?.status ?? ""
  ).toLowerCase();
  const myPaymentMethod = String((myPayment as { payment_method?: string | null } | null)?.payment_method ?? "").toLowerCase();
  const hasInvitedPayment = myPaymentStatus === "invited";
  const myPrefId = String((myPayment as { mp_preference_id?: string | null } | null)?.mp_preference_id ?? "").trim();
  const hasPaid = myPaymentStatus === "approved" || myPaymentStatus === "paid";
  const mercadoPagoPayHref = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${encodeURIComponent(myPrefId)}`;
  const paymentRowId = String((myPayment as { id?: string | null } | null)?.id ?? "").trim();
  /** Preferencia vencida en MP: estado explícito en DB (evita Date.now en render por react-hooks/purity). */
  const needsPaymentRegenerate = String(myPaymentStatus).toLowerCase() === "expired";
  const payRegenErr = sp.pay_regen_error === "1";
  const myPaymentBanner = (() => {
    const s = myPaymentStatus;
    if (s === "approved" || s === "paid") return "approved" as const;
    if (s === "pending") return "pending" as const;
    if (s === "rejected" || s === "expired") return "rejected" as const;
    if (s === "invited") return "invited" as const;
    return "none" as const;
  })();

  const isParticipant = participants.some((participant) => participant.player_id === user.id);
  const isOwner = Boolean(user.id && match.owner_id && user.id === match.owner_id);

  const { data: groupChatRow } = await supabase
    .from(DB_TABLES.groupChats)
    .select("id")
    .eq("match_id", id)
    .maybeSingle();
  const groupChatId = String((groupChatRow as { id?: string } | null)?.id ?? "").trim() || null;
  const groupChatHref = groupChatId ? `/comunidad/mensajes/grupo/${groupChatId}` : null;
  const showGroupChat = Boolean(groupChatHref && (isOwner || isParticipant));

  // Check if current user already submitted result
  const { data: myResult } = await supabase
    .from(DB_TABLES.matchResults)
    .select("id, status")
    .eq("match_id", id)
    .eq("proposed_by", user.id)
    .maybeSingle();

  const alreadySubmitted = Boolean(myResult);

  const { data: matchResultRow } = await supabase
    .from(DB_TABLES.matchResults)
    .select("id")
    .eq("match_id", id)
    .maybeSingle();

  const matchResultId = (matchResultRow as { id?: string } | null)?.id;

  const { count: confirmCount } = matchResultId
    ? await supabase
        .from(DB_TABLES.matchResultConfirmations)
        .select("id", { count: "exact", head: true })
        .eq("match_result_id", matchResultId)
        .eq("decision", "confirm")
    : { count: 0 };

  const { data: favoritesRows } = await supabase
    .from(DB_TABLES.userFavorites)
    .select("favorite_user_id")
    .eq("user_id", user.id);
  const favoriteIds = ((favoritesRows ?? []) as { favorite_user_id: string }[]).map((f) => f.favorite_user_id);

  const isPrivate = isMatchPrivate(match.visibility);
  const inviteOpen = sp.invite === "true";
  const ownerId = match.owner_id ?? "";
  const isFriendOfOwner = Boolean(ownerId && favoriteIds.includes(ownerId));

  const canAccessPrivate =
    !isPrivate || isOwner || isParticipant || isFriendOfOwner || inviteOpen;

  if (isPrivate && !canAccessPrivate) {
    redirect("/buscar-partido");
  }

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";

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

  const roundedDuration = Math.round((Number(detail.duration_minutes ?? 0) / 5)) * 5;
  const freeSlots = Math.max(0, 4 - participants.length);
  const matchStatusNorm = String(match.match_status ?? "").toLowerCase();
  const canJoinAsNewPlayer =
    !isParticipant &&
    !isOwner &&
    freeSlots > 0 &&
    matchStatusNorm !== "full" &&
    matchStatusNorm !== "cancelled" &&
    matchStatusNorm !== "finished";
  const isLevelRestricted = Boolean(match.level_restricted);
  let userLevelDiff = 0;

  if (isLevelRestricted && !isOwner && !isParticipant && canJoinAsNewPlayer) {
    const [{ data: ownerLvl }, { data: userLvl }] = await Promise.all([
      supabase.from(DB_TABLES.profiles).select("level").eq("user_id", match.owner_id ?? "").maybeSingle(),
      supabase.from(DB_TABLES.profiles).select("level").eq("user_id", user.id).maybeSingle(),
    ]);
    const oLevel = Number((ownerLvl as { level?: number | null } | null)?.level ?? 0);
    const uLevel = Number((userLvl as { level?: number | null } | null)?.level ?? 0);
    userLevelDiff = Math.abs(oLevel - uLevel);
  }

  const userOutOfLevel = isLevelRestricted && userLevelDiff > 1;
  const typeLabel = detail.match_type === "competitivo" ? "Competitivo" : "Amistoso";
  const categoryLabel =
    detail.gender_category === "masculino"
      ? "Masculino"
      : detail.gender_category === "femenino"
        ? "Femenino"
        : "Mixto";

  const payStatus = String(match.payment_status ?? "").toLowerCase();
  const matchFullyPaid = payStatus === "paid";
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
  const hourAr = match.scheduled_time
    ? String(match.scheduled_time).slice(0, 5)
    : format(parseISO(detail.date), "HH:mm", { locale: es });
  const matchDateForHero = parseISO(detail.date);
  const heroWeekday = format(matchDateForHero, "EEE", { locale: es }).replace(/\.$/, "");
  const heroWeekdayCap = heroWeekday.charAt(0).toUpperCase() + heroWeekday.slice(1);
  const heroDayNum = format(matchDateForHero, "d", { locale: es });
  const heroMonthShort = format(matchDateForHero, "MMM", { locale: es }).replace(/\.$/, "");
  const heroMonthCap = heroMonthShort.charAt(0).toUpperCase() + heroMonthShort.slice(1);
  const heroDateHeadline = `${heroWeekdayCap} ${heroDayNum} ${heroMonthCap}`;
  const heroMatchTitleLine = `${detail.club_name ?? "Club"} · ${heroDateHeadline} · ${hourAr}`;
  const clubWhenDurationLine = `${heroDateHeadline} · ${hourAr} · ${roundedDuration} min`;
  const partyUrl = siteOrigin ? `${siteOrigin}/partidos/${id}` : `https://padelibre.app/partidos/${id}`;
  const sharePath = partyUrl;
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

  const nivelText = match.level_restricted
    ? `restringido · ${ownerLevelLabel}`
    : "abierto a todos";

  const sharePlayerLines = Array.from({ length: 4 }, (_, i) => {
    const p = participants[i];
    if (p) {
      const category =
        splitOfficialCategoryLine(formatProfileNivelFromRow(p)).category || "Sin nivel";
      return `*${p.name ?? "Jugador"}* _(${category})_`;
    }
    return "Falta 1 jugador";
  });

  const shareWhatsText = [
    `*¿Quién se anima?*`,
    `*PARTIDO EN ${(detail.club_name ?? "CLUB").toUpperCase()}*`,
    ``,
    `_Fecha:_ *${longDateAr} · ${scheduledTimeStr} · ${roundedDuration} min*`,
    `_Género:_ *${genderLabel}*`,
    `_Nivel:_ *${nivelText}*`,
    ``,
    `_Jugadores:_`,
    ...sharePlayerLines,
    ``,
    sharePath,
    ``,
    `*¡Sumate antes de que se llene!*`,
  ].join("\n");

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-2">
        <Link href="/buscar-partido" className="inline-block text-sm font-semibold text-[#0585FC] hover:text-[#0461C4]">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Detalle del partido</h1>
      </header>

      <section
        className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#031733] to-[#0461C4] p-6 shadow-xl ring-1 ring-white/10 dark:ring-white/15"
        aria-label="Equipos del partido"
      >
        <p className="mb-6 text-center text-sm leading-snug text-white/80">{heroMatchTitleLine}</p>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-white/60">Equipo 1</p>
            <div className="flex justify-center gap-2 sm:gap-3">
              {Array.from({ length: 2 }, (_, i) => {
                const participant = team1Players[i];
                if (!participant) {
                  return (
                    <div
                      key={`hero-t1-empty-${i}`}
                      className="flex w-0 min-w-0 max-w-[9rem] flex-1 flex-col items-center gap-1"
                    >
                      <div
                        className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-white/30 bg-white/5"
                        aria-hidden
                      >
                        <User className="h-6 w-6 text-white/45" strokeWidth={1.75} aria-hidden />
                      </div>
                      <span className="text-center text-xs font-medium text-white/35">Libre</span>
                    </div>
                  );
                }
                const name = participant.name?.trim() || "Jugador";
                const level = formatProfileNivelFromRow(participant);
                return (
                  <div
                    key={participant.player_id}
                    className="flex w-0 min-w-0 max-w-[9rem] flex-1 flex-col items-center gap-1"
                  >
                    <ProfileAvatar
                      avatarUrl={participant.avatar_url}
                      name={name}
                      size={56}
                      ringClassName="ring-2 ring-white/20"
                    />
                    <p className="w-full truncate text-center text-sm font-semibold text-white">{name}</p>
                    <p className="w-full truncate text-center text-xs text-white/70">{level}</p>
                  </div>
                );
              })}
            </div>
            {canJoinAsNewPlayer && team1Count < 2 ? (
              <div className="mt-4 flex justify-center">
                <JoinMatchPaymentModal
                  matchId={id}
                  team={1}
                  clubName={detail.club_name ?? "Club"}
                  matchDate={clubWhenDurationLine}
                  courtName={detail.court_name ?? "Cancha"}
                  pricePerPlayer={Math.round((detail.total_price ?? 0) / 4 * 1.05)}
                  clubHasMp={clubHasMp}
                  clubAcceptsCash={clubAcceptsCash}
                  clubAcceptsTransfer={clubAcceptsTransfer}
                  bankAlias={bankAlias}
                  bankCbu={bankCbu}
                  clubWhatsapp={clubWhatsapp}
                  onboardingComplete={onboardingComplete}
                />
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-center justify-center self-center px-0.5 pt-8 sm:px-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ring-2 ring-white/25 sm:h-16 sm:w-16">
              <span className="text-base font-bold tracking-tight text-white sm:text-lg">VS</span>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-white/60">Equipo 2</p>
            <div className="flex justify-center gap-2 sm:gap-3">
              {Array.from({ length: 2 }, (_, i) => {
                const participant = team2Players[i];
                if (!participant) {
                  return (
                    <div
                      key={`hero-t2-empty-${i}`}
                      className="flex w-0 min-w-0 max-w-[9rem] flex-1 flex-col items-center gap-1"
                    >
                      <div
                        className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-white/30 bg-white/5"
                        aria-hidden
                      >
                        <User className="h-6 w-6 text-white/45" strokeWidth={1.75} aria-hidden />
                      </div>
                      <span className="text-center text-xs font-medium text-white/35">Libre</span>
                    </div>
                  );
                }
                const name = participant.name?.trim() || "Jugador";
                const level = formatProfileNivelFromRow(participant);
                return (
                  <div
                    key={participant.player_id}
                    className="flex w-0 min-w-0 max-w-[9rem] flex-1 flex-col items-center gap-1"
                  >
                    <ProfileAvatar
                      avatarUrl={participant.avatar_url}
                      name={name}
                      size={56}
                      ringClassName="ring-2 ring-white/20"
                    />
                    <p className="w-full truncate text-center text-sm font-semibold text-white">{name}</p>
                    <p className="w-full truncate text-center text-xs text-white/70">{level}</p>
                  </div>
                );
              })}
            </div>
            {canJoinAsNewPlayer && team2Count < 2 ? (
              <div className="mt-4 flex justify-center">
                <JoinMatchPaymentModal
                  matchId={id}
                  team={2}
                  clubName={detail.club_name ?? "Club"}
                  matchDate={clubWhenDurationLine}
                  courtName={detail.court_name ?? "Cancha"}
                  pricePerPlayer={Math.round((detail.total_price ?? 0) / 4 * 1.05)}
                  clubHasMp={clubHasMp}
                  clubAcceptsCash={clubAcceptsCash}
                  clubAcceptsTransfer={clubAcceptsTransfer}
                  bankAlias={bankAlias}
                  bankCbu={bankCbu}
                  clubWhatsapp={clubWhatsapp}
                  onboardingComplete={onboardingComplete}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2 border-t border-white/15 pt-5">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${
              detail.match_type === "competitivo" ? "bg-blue-500/50" : "bg-emerald-500/50"
            }`}
          >
            {typeLabel}
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">{categoryLabel}</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
            {detail.level_restricted ? "Nivel restringido" : "Cualquier nivel"}
          </span>
        </div>

      </section>

      <article
        className={`${PLAYER_CARD_INTERACTIVE} rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">{detail.club_name ?? "Club"}</h2>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isPrivate
                ? "border border-[#0585FC]/25 bg-[#0585FC]/10 text-[#0461C4] dark:text-sky-300"
                : "border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
            }`}
          >
            {isPrivate ? "Privado" : "Público"}
          </span>
        </div>
        {detail.club_location?.trim() ? (
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">{detail.club_location}</p>
        ) : null}
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {clubWhenDurationLine}
          <span className="text-[var(--text-tertiary)]"> · Cancha: </span>
          <span className="font-medium text-[var(--text-primary)]">{detail.court_name ?? "Cancha"}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
          <div>
            <p className="text-xs font-medium text-[var(--text-tertiary)]">Precio total</p>
            <p className="text-xl font-bold text-[#0461C4]">
              ${Math.round((detail.total_price ?? 0) * 1.05).toLocaleString("es-AR")}
            </p>
          </div>
          {isParticipant ? (
            <div className="mt-2 rounded-xl bg-[var(--bg-subtle)] px-3 py-2.5">
              <p className="text-xs font-medium text-[var(--text-tertiary)]">Tu parte</p>
              <p className="text-base font-bold text-[var(--text-primary)]">
                ${Math.round((detail.total_price ?? 0) / 4 * 1.05).toLocaleString("es-AR")}
              </p>
              {hasPaid ? (
                <p className="mt-0.5 text-xs font-semibold text-emerald-600">✓ Pagado</p>
              ) : myPaymentStatus === "pending" || myPaymentStatus === "invited" ? (
                <p className="mt-0.5 text-xs font-semibold text-amber-600">Pendiente de confirmación</p>
              ) : myPaymentStatus === "expired" ? (
                <p className="mt-0.5 text-xs font-semibold text-rose-600">Pago vencido</p>
              ) : (
                <p className="mt-0.5 text-xs font-semibold text-slate-500">Sin pago registrado</p>
              )}
            </div>
          ) : null}
        </div>
      </article>

      {isOwner ? (
        <section className="rounded-2xl border border-[var(--border-subtle)] border-l-[3px] border-l-[#0585FC] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">Tu partido</h2>
            <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white dark:bg-emerald-500">
              Organizás
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
            {participants.length}/4 jugadores confirmados
            {freeSlots > 0 ? ` · ${freeSlots} cupo${freeSlots === 1 ? "" : "s"} libre${freeSlots === 1 ? "" : "s"}` : ""}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareWhatsText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-center text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,133,252,0.35)] transition hover:brightness-95 active:scale-[0.99]"
              style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
            >
              <MessageCircle size={18} aria-hidden />
              Compartir por WhatsApp
            </a>
            {showGroupChat && groupChatHref ? (
              <Link
                href={groupChatHref}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#0585FC]/25 bg-[#0585FC]/5 py-3 text-center text-sm font-semibold text-[#0461C4] transition hover:bg-[#0585FC]/10 dark:text-sky-400"
              >
                <MessageCircle size={16} aria-hidden />
                Chat del grupo
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
          </div>
        </section>
      ) : null}

      {isParticipant && !isOwner && showGroupChat && groupChatHref ? (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
          <Link
            href={groupChatHref}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#0585FC]/25 bg-[#0585FC]/5 py-3 text-center text-sm font-semibold text-[#0461C4] transition hover:bg-[#0585FC]/10 dark:text-sky-400"
          >
            <MessageCircle size={16} aria-hidden />
            Chat del grupo
          </Link>
        </section>
      ) : null}

      {isParticipant ? (
        <MatchStatusBanner
          matchFullyPaid={matchFullyPaid}
          myPaymentNorm={myPaymentBanner}
          confirmedPlayers={participants.length}
        />
      ) : null}

      {isParticipant && myPaymentBanner === "pending" ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-[var(--shadow-card)] dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Pago pendiente — completá el pago para confirmar tu lugar
            </p>
          </div>
          {needsPaymentRegenerate && paymentRowId ? (
            <form action={regenerarLinkPago} className="mt-3">
              <input type="hidden" name="payment_id" value={paymentRowId} />
              <input type="hidden" name="match_id" value={id} />
              <Button type="submit" variant="primary">
                {PAYMENT_COPY.regenerateCta}
              </Button>
            </form>
          ) : myPrefId ? (
            <a
              href={mercadoPagoPayHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full rounded-2xl py-3 text-center text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
              style={{ background: "var(--color-brand-gradient)" }}
            >
              Pagar ahora
            </a>
          ) : null}
        </section>
      ) : null}
      {isParticipant && myPaymentBanner === "approved" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-[var(--shadow-card)] dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2">
            <span className="text-lg text-emerald-700 dark:text-emerald-400">✓</span>
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">Lugar confirmado</p>
          </div>
        </section>
      ) : null}

      {isParticipant && myPaymentStatus === "invited" && myPaymentMethod === "transfer" && clubWhatsapp ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">¿Ya transferiste?</p>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
            Avisale al club por WhatsApp para confirmar tu lugar. Guardá el comprobante para mostrarlo al ingresar.
          </p>
          <ConfirmTransferWhatsappButton
            clubWhatsapp={clubWhatsapp}
            message={`Hola, soy ${userName}, me uní al partido del ${longDateAr} a las ${scheduledTimeStr} en ${detail.club_name ?? "el club"}. Transferí $${Math.round((detail.total_price ?? 0) / 4 * 1.05).toLocaleString("es-AR")} al alias ${bankAlias ?? bankCbu ?? ""}. Confirmo mi presencia.`}
          />
        </section>
      ) : null}

      {payRegenErr ? (
        <Alert variant="error">No pudimos generar el nuevo link. Intentá de nuevo en un rato.</Alert>
      ) : null}

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

      {cancelOk ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          Cancelaste tu lugar. Si ya habías pagado, quedó registrada la solicitud de reembolso.
        </p>
      ) : null}

      {cancelErrorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {cancelErrorMessage}
        </p>
       ) : null}

      {joinAccepted && isOwner ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          El jugador será redirigido al pago para confirmar su lugar (recibirá un aviso con el link).
        </p>
      ) : null}

      {userOutOfLevel && canJoinAsNewPlayer && !joinSent ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-3">
          <p className="font-semibold text-amber-800 dark:text-amber-300">
            Tu nivel no es compatible con este partido
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Podés enviar una solicitud especial. Los jugadores del partido votarán si te aceptan.
          </p>
          <RequestJoinButton matchId={id} levelOverride={true} submitLabel="Solicitar revisión" />
        </div>
      ) : joinErrorKey === "nivel" ? (
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

      {isParticipant && !isMatchFinished && matchStatusNorm !== "cancelled" ? (
        <section className={`${PLAYER_CARD_INTERACTIVE} rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm`}>
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Tu cupo</h2>
          <p className="mt-1 text-sm text-slate-600">
            Si ya no podés jugar, cancelá tu lugar. El organizador será notificado.
          </p>
          <form action={cancelParticipation} className="mt-4">
            <input type="hidden" name="match_id" value={id} />
            <button
              type="submit"
              className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
            >
              Cancelar lugar
            </button>
          </form>
        </section>
      ) : null}

      {isParticipant && isMatchFinished ? (
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
              teamALabel={resultTeam1Label}
              teamBLabel={resultTeam2Label}
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

      {hasInvitedPayment && !isParticipant ? (
        <section className="rounded-2xl border border-[#0585FC]/30 bg-[#0585FC]/5 p-4 space-y-3">
          <h2 className="text-base font-bold text-[#0461C4]">¡Fuiste invitado a este partido!</h2>
          <p className="text-sm text-slate-700">Confirmá tu lugar pagando tu parte del turno.</p>
          <form action={requestToJoin}>
            <input type="hidden" name="match_id" value={id} />
            <button
              type="submit"
              className="w-full rounded-2xl py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)]"
              style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
            >
              Confirmar y pagar
            </button>
          </form>
        </section>
      ) : null}

      {isParticipant && !isOwner && !isMatchFinished ? (
        <section className="space-y-3 rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-sm dark:border-emerald-900/50 dark:bg-slate-900/40">
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
            <JoinWithTeamForm
              matchId={id}
              team1Count={team1Count}
              team2Count={team2Count}
            />
          </div>
        </section>
      ) : null}

      {canJoinAsNewPlayer && !isMatchFinished && match.level_restricted && !isOwner ? (
        <div className="space-y-2">
          <JoinWithTeamForm
            matchId={id}
            team1Count={team1Count}
            team2Count={team2Count}
          />
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






