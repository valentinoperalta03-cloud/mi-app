import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AtSign, Clock, MapPin, MessageCircle, Phone, Shield } from "lucide-react";
import ClubGalleryLightbox from "@/components/club-gallery-lightbox";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { checkOnboardingStatus } from "@/lib/admin/onboarding-check";
import type { ClubRow, CourtRow } from "@/lib/database.types";
import { PLAYER_CARD_INTERACTIVE, PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatSurface(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const s = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    cemento: "Cemento",
    cristal: "Cristal",
    "cesped sintetico": "Césped sintético",
    moqueta: "Moqueta",
  };
  return map[s] ?? raw.trim();
}

function instagramHref(handle: string | null | undefined): string | null {
  const u = (handle ?? "").replace(/^@+/, "").trim();
  return u ? `https://instagram.com/${u}` : null;
}

function whatsappHref(num: string | null | undefined): string | null {
  const digits = (num ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function phoneHref(num: string | null | undefined): string | null {
  const digits = (num ?? "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export default async function ClubDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: clubRow, error: clubError } = await supabase
    .from(DB_TABLES.clubs)
    .select(
      "name,description,location,cover_image_url,logo_url,contact_phone,whatsapp,instagram,business_hours,cancellation_policy,gallery_image_1,gallery_image_2,gallery_image_3,gallery_image_4,is_active"
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (clubError || !clubRow) {
    notFound();
  }

  const club = { id, ...(clubRow as Omit<ClubRow, "id">) } as ClubRow;
  const bookingReadiness = await checkOnboardingStatus(supabase, id);
  const canReserve = bookingReadiness.canReceiveReservations;

  const { data: courtsData } = await supabase
    .from(DB_TABLES.courts)
    .select("id,name,price,surface,indoor")
    .eq("club_id", id)
    .order("name");

  const courts = (courtsData ?? []) as CourtRow[];
  const clubName = club.name ?? "Club";
  const location = club.location ?? "";
  const heroSrc = club.cover_image_url?.trim() || club.logo_url?.trim() || null;
  const logoSrc = club.logo_url?.trim() || null;

  const galleryUrls = [club.gallery_image_1, club.gallery_image_2, club.gallery_image_3, club.gallery_image_4]
    .map((u) => (u ?? "").trim())
    .filter(Boolean);

  const ig = instagramHref(club.instagram);
  const wa = whatsappHref(club.whatsapp);
  const tel = phoneHref(club.contact_phone);

  return (
    <>
      <MotionPage className="relative mx-auto min-h-screen w-full max-w-md bg-transparent pb-28 pt-0">
        <div className="px-4 pt-4">
          <Link
            href="/clubes"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0085FC] transition hover:text-[#0461C4]"
          >
            <ArrowLeft className="h-4 w-4" />
            Clubes
          </Link>
        </div>

        <div className="relative -mx-4 mt-3 h-48 w-[calc(100%+2rem)] overflow-hidden">
          {heroSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0085FC] via-sky-500 to-cyan-400 text-3xl font-bold text-white/90">
              {clubName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-4">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white bg-white/15 text-base font-semibold text-white backdrop-blur-sm">
                {clubName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1 pb-0.5">
              <h1 className="text-lg font-semibold leading-tight tracking-tight text-white drop-shadow-sm">{clubName}</h1>
              {club.business_hours?.trim() ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                  <Clock className="h-3 w-3" />
                  {club.business_hours.trim()}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6 px-4 pt-6">
          {!canReserve ? (
            <section className="rounded-2xl border border-rose-200/70 bg-rose-50/90 p-4 text-sm font-semibold text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100">
              Este club no está disponible por el momento.
            </section>
          ) : null}
          {location ? (
            <p className="flex items-start gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0085FC]" />
              <span>{location}</span>
            </p>
          ) : null}

          {club.description?.trim() ? (
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sobre el club</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {club.description.trim()}
              </p>
            </section>
          ) : null}

          <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Contacto</h2>
            <ul className="space-y-3 text-sm">
              {tel ? (
                <li>
                  <a href={tel} className="flex items-center gap-2 font-medium text-[#0461C4] transition hover:underline">
                    <Phone className="h-4 w-4 shrink-0 text-[#0085FC]" />
                    {club.contact_phone?.trim()}
                  </a>
                </li>
              ) : null}
              {wa ? (
                <li>
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 font-medium text-[#0461C4] transition hover:underline"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                    WhatsApp
                  </a>
                </li>
              ) : null}
              {ig ? (
                <li>
                  <a
                    href={ig}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 font-medium text-[#0461C4] transition hover:underline"
                  >
                    <AtSign className="h-4 w-4 shrink-0 text-pink-600" />
                    @{club.instagram?.replace(/^@+/, "").trim()}
                  </a>
                </li>
              ) : null}
              {club.business_hours?.trim() ? (
                <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#0085FC]" />
                  <span>{club.business_hours.trim()}</span>
                </li>
              ) : null}
            </ul>
            {!tel && !wa && !ig && !club.business_hours?.trim() ? (
              <p className="text-xs text-slate-500">Este club aún no cargó datos de contacto.</p>
            ) : null}
          </section>

          {club.cancellation_policy?.trim() ? (
            <section className="space-y-2 rounded-2xl border border-amber-200/60 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
              <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                <Shield className="h-4 w-4" />
                Política de cancelación
              </h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-950/90 dark:text-amber-100/90">
                {club.cancellation_policy.trim()}
              </p>
            </section>
          ) : null}

          {galleryUrls.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Galería</h2>
              <ClubGalleryLightbox urls={galleryUrls} />
            </section>
          ) : null}

          {courts.length === 0 ? (
            <EmptyStateCard
              title="Este club no tiene canchas disponibles"
              subtitle="Volvé más tarde o elegí otro club desde la lista."
              ctaHref="/clubes"
              ctaLabel="Ver otros clubes"
            />
          ) : (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Canchas</h2>
              <ul className="space-y-3">
                {courts.map((court) => {
                  const price = court.price ?? 0;
                  const displayPrice = price;
                  const courtName = court.name ?? "Cancha";
                  const indoorLabel = court.indoor ? "Techada" : "Descubierta";
                  const surfaceLabel = formatSurface(court.surface ?? null);
                  const href = `/crear-partido?clubId=${encodeURIComponent(id)}`;
                  return (
                    <li key={court.id}>
                      <article className={`${PLAYER_CARD_INTERACTIVE} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-950 dark:text-slate-100">{courtName}</h3>
                          <p className="text-sm font-semibold text-[#0461C4]">${new Intl.NumberFormat("es-AR").format(displayPrice)} / turno (90 min)</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {surfaceLabel} · {indoorLabel}
                          </p>
                        </div>
                        <Link
                          href={href}
                          aria-disabled={!canReserve}
                          className={`inline-flex shrink-0 justify-center ${PLAYER_PRIMARY_BUTTON} ${
                            !canReserve ? "pointer-events-none opacity-50 grayscale" : ""
                          }`}
                        >
                          Reservar
                        </Link>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </MotionPage>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto w-full max-w-md px-4">
          <Link
            href={`/crear-partido?clubId=${encodeURIComponent(id)}`}
            aria-disabled={!canReserve}
            className={`flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#0085FC] to-cyan-500 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-[#0085FC]/25 transition hover:brightness-105 active:scale-[0.99] ${
              !canReserve ? "pointer-events-none opacity-50 grayscale" : ""
            }`}
          >
            Crear partido aquí
          </Link>
        </div>
      </div>
    </>
  );
}
