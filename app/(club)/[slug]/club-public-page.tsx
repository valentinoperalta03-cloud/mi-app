"use client";

import Image from "next/image";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { useState } from "react";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });

export type PublicClub = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  location: string | null;
  city: string | null;
  province: string | null;
  business_hours: string | null;
  services: string[] | null;
  instagram: string | null;
  whatsapp: string | null;
  facebook: string | null;
  tiktok: string | null;
};

export type PublicCourt = {
  id: string;
  name: string | null;
  surface: string | null;
  indoor: boolean | null;
  price: number | null;
};

type Props = {
  club: PublicClub;
  courts: PublicCourt[];
  isLoggedIn: boolean;
};

const SERVICES_CATALOG: Record<string, { emoji: string; label: string }> = {
  parking: { emoji: "🅿️", label: "Estacionamiento" },
  estacionamiento: { emoji: "🅿️", label: "Estacionamiento" },
  vestuarios: { emoji: "🚿", label: "Vestuarios" },
  buffet: { emoji: "🍴", label: "Buffet" },
  wifi: { emoji: "📶", label: "WiFi" },
  iluminacion: { emoji: "💡", label: "Iluminación" },
  pileta: { emoji: "🏊", label: "Pileta" },
  gimnasio: { emoji: "💪", label: "Gimnasio" },
  tienda: { emoji: "🛍️", label: "Tienda" },
  escuela: { emoji: "🎓", label: "Escuela" },
};

function formatSurface(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Superficie no definida";
  const s = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    cemento: "Cemento",
    cristal: "Cristal",
    "cesped sintetico": "Césped sintético",
    moqueta: "Moqueta",
  };
  return map[s] ?? raw.trim();
}

function instagramHref(handle: string | null): string | null {
  const u = (handle ?? "").replace(/^@+/, "").trim();
  return u ? `https://instagram.com/${u}` : null;
}

function whatsappHref(num: string | null): string | null {
  const digits = (num ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function facebookHref(handle: string | null): string | null {
  const u = (handle ?? "").replace(/^@+/, "").trim();
  return u ? `https://facebook.com/${u}` : null;
}

function tiktokHref(handle: string | null): string | null {
  const u = (handle ?? "").replace(/^@+/, "").trim();
  return u ? `https://tiktok.com/@${u}` : null;
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a9 9 0 0 0-7.75 13.55L3 21l4.6-1.2A9 9 0 1 0 12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8.7 8.4c.2-.45.4-.46.6-.47.16-.01.34-.01.5.01.16.02.38-.06.6.45.24.55.79 1.9.86 2.04.07.14.11.3.02.48-.09.18-.14.3-.28.46-.14.16-.29.35-.42.47-.14.12-.28.26-.12.5.16.24.71 1.16 1.52 1.88 1.05.93 1.93 1.22 2.18 1.36.25.14.4.12.55-.07.15-.19.63-.73.8-.98.17-.25.34-.2.57-.12.24.08 1.5.71 1.75.84.25.13.42.19.48.3.06.11.06.62-.15 1.22-.21.6-1.22 1.15-1.7 1.22-.44.07-.98.1-1.58-.1-.36-.12-.83-.28-1.42-.55-2.5-1.08-4.13-3.6-4.26-3.77-.13-.17-1.03-1.37-1.03-2.61 0-1.24.65-1.85.88-2.11Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 8.5h2V5.6h-2c-2 0-3.4 1.4-3.4 3.5v1.7H8.6v3h2v6.2h3v-6.2h2.1l.5-3h-2.6V9.4c0-.6.3-.9.9-.9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TiktokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 3v10.7a2.6 2.6 0 1 1-2.2-2.57V8.4a5.3 5.3 0 1 0 4.9 5.28V9.5a6.5 6.5 0 0 0 3.8 1.22V8a3.8 3.8 0 0 1-3.8-3.8V3H14Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AuthRequiredModal({ clubName, slug, onClose }: { clubName: string; slug: string; onClose: () => void }) {
  const nextHref = `/login?next=/${slug}`;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 p-6 text-center"
        style={{ backgroundColor: "#0F2038" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`${spaceGrotesk.className} text-lg font-bold text-white`}>
          Para reservar en {clubName} necesitás una cuenta en PadeLibre
        </h3>
        <p className="mt-2 text-sm text-white/60">Es gratis y solo te lleva 2 minutos 🎾</p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={nextHref}
            className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] py-3.5 text-sm font-bold text-white"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href={nextHref}
            className="flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] py-3.5 text-sm font-semibold text-white"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ClubPublicPage({ club, courts, isLoggedIn }: Props) {
  const [showAuthModal, setShowAuthModal] = useState(false);

  const cityProvince = [club.city, club.province]
    .filter((v): v is string => Boolean(v?.trim()))
    .map((v) => v.trim().toUpperCase())
    .join(", ");

  const services = (club.services ?? []).filter(Boolean);
  const socialLinks = [
    { key: "instagram", href: instagramHref(club.instagram), Icon: InstagramIcon, label: "Instagram" },
    { key: "whatsapp", href: whatsappHref(club.whatsapp), Icon: WhatsappIcon, label: "WhatsApp" },
    { key: "facebook", href: facebookHref(club.facebook), Icon: FacebookIcon, label: "Facebook" },
    { key: "tiktok", href: tiktokHref(club.tiktok), Icon: TiktokIcon, label: "TikTok" },
  ].filter((s) => s.href);

  return (
    <main className={`min-h-dvh ${spaceGrotesk.className}`} style={{ backgroundColor: "#0C1829" }}>
      <div className="h-0.5 w-full" style={{ backgroundColor: "#CCFF00" }} />

      <nav className="mx-auto flex w-full max-w-[480px] items-center justify-between px-4 py-4">
        <Image src="/logo.png" alt="PadeLibre" width={28} height={28} className="rounded-md" />
        {!isLoggedIn ? (
          <Link
            href={`/login?next=/${club.slug}`}
            className="rounded-xl border border-white/15 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white"
          >
            Iniciar sesión
          </Link>
        ) : null}
      </nav>

      <div className="mx-auto w-full max-w-[480px] px-0 pb-20">
        <section className="relative h-[180px] w-full overflow-hidden">
          {club.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.cover_image_url} alt={club.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-white/[0.06]" />
          )}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, #0C1829 0%, transparent 60%)" }}
          />
          <div className="absolute bottom-3 left-4 flex items-end gap-3">
            <div
              className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border-2 border-[#0C1829] bg-white/10"
              style={{ borderRadius: "50%" }}
            >
              {club.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="pb-1">
              <h1 className="text-[22px] font-bold leading-tight text-white">{club.name}</h1>
              {cityProvince ? <p className="text-[13px] text-white/65">{cityProvince}</p> : null}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-8 px-4 pt-6">
          <div className="flex flex-col gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href={`/${club.slug}/reservar`}
                  style={{ minHeight: 52 }}
                  className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-base font-bold text-white"
                >
                  🎾 Reservar una cancha
                </Link>
                <Link
                  href={`/${club.slug}/partidos`}
                  style={{ minHeight: 52 }}
                  className="flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/[0.08] text-base font-semibold text-white"
                >
                  🏆 Ver partidos abiertos
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  style={{ minHeight: 52 }}
                  className="w-full rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-base font-bold text-white"
                >
                  🎾 Reservar una cancha
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  style={{ minHeight: 52 }}
                  className="w-full rounded-2xl border border-white/20 bg-white/[0.08] text-base font-semibold text-white"
                >
                  🏆 Ver partidos abiertos
                </button>
              </>
            )}
            <p className="text-center text-xs leading-relaxed text-white/45">
              Reservar cancha: pagás una seña y la cancha es tuya · Partido abierto: encontrá con quién jugar
            </p>
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-[18px] font-bold text-white">Sobre el club</h2>
            {club.description ? <p className="text-sm leading-relaxed text-white/70">{club.description}</p> : null}
            {club.business_hours ? <p className="text-sm text-white/60">🕐 {club.business_hours}</p> : null}
          </section>

          {services.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-[18px] font-bold text-white">Servicios</h2>
              <div className="grid grid-cols-3 gap-2">
                {services.map((s) => {
                  const meta = SERVICES_CATALOG[s.toLowerCase()] ?? { emoji: "🎾", label: s };
                  return (
                    <div
                      key={s}
                      className="flex flex-col items-center gap-1 rounded-xl border border-white/[0.12] bg-white/[0.08] px-2 py-3 text-center"
                    >
                      <span className="text-xl">{meta.emoji}</span>
                      <span className="text-[11px] font-medium text-white/75">{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {courts.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-[18px] font-bold text-white">Canchas</h2>
              <div className="flex flex-col gap-2">
                {courts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl bg-white/[0.05] px-4 py-3"
                    style={{ borderRadius: 12 }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{c.name ?? "Cancha"}</p>
                      <p className="text-xs text-white/55">
                        {formatSurface(c.surface)} · {c.indoor ? "Techada" : "Descubierta"}
                      </p>
                    </div>
                    {typeof c.price === "number" ? (
                      <p className="text-sm font-bold text-[#0085FC]">
                        ${new Intl.NumberFormat("es-AR").format(c.price)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {socialLinks.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-[18px] font-bold text-white">Las redes de {club.name}</h2>
              <div className="flex gap-3">
                {socialLinks.map(({ key, href, Icon, label }) => (
                  <a
                    key={key}
                    href={href ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.08] text-white"
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {showAuthModal ? (
        <AuthRequiredModal clubName={club.name} slug={club.slug} onClose={() => setShowAuthModal(false)} />
      ) : null}
    </main>
  );
}
