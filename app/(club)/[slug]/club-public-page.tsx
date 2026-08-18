"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CircleHelp,
  CreditCard,
  FileText,
  LogOut,
  Menu,
  Settings,
  Shield,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { Space_Grotesk } from "next/font/google";
import { useRouter } from "next/navigation";
import { useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";

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
  playerName: string;
  profileComplete: boolean;
};

const SERVICES_CATALOG: Record<string, { emoji: string; label: string }> = {
  cancha_techada: { emoji: "🏠", label: "Complejo techado" },
  filmacion: { emoji: "🎥", label: "Filmación de partidos" },
  parrilla: { emoji: "🔥", label: "Parrilla" },
  cobertura_medica: { emoji: "🏥", label: "Cobertura médica" },
  estacionamiento: { emoji: "🅿️", label: "Estacionamiento" },
  venta_pelotas: { emoji: "🎾", label: "Venta de pelotas" },
  pelotas_prestadas: { emoji: "🎾", label: "Pelotas prestadas" },
  paletas_prestadas: { emoji: "🏓", label: "Paletas prestadas" },
  alquiler_paletas: { emoji: "🏓", label: "Alquiler de paletas" },
  venta_grips: { emoji: "🔧", label: "Venta de grips" },
  venta_indumentaria: { emoji: "👕", label: "Venta de indumentaria" },
  vestuarios: { emoji: "🚿", label: "Vestuarios con duchas" },
  wifi: { emoji: "📶", label: "WiFi" },
  buffet: { emoji: "🍔", label: "Bar / Buffet" },
  pro_shop: { emoji: "🛍️", label: "Pro shop" },
  cumpleanos: { emoji: "🎂", label: "Eventos y cumpleaños" },
  aire_acondicionado: { emoji: "❄️", label: "Aire acondicionado" },
  acceso_discapacidad: { emoji: "♿", label: "Acceso para discapacitados" },
  guardarropa: { emoji: "👜", label: "Guardarropa" },
  gimnasio: { emoji: "💪", label: "Gimnasio" },
};

const HOW_IT_WORKS = [
  { emoji: "🎾", title: "Elegís horario", subtitle: "Ves disponibilidad en tiempo real" },
  { emoji: "💳", title: "Pagás la seña", subtitle: "Por Mercado Pago de forma segura" },
  { emoji: "✅", title: "Cancha confirmada", subtitle: "Al instante, sin llamadas" },
];

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

function IncompleteProfileModal({
  open,
  onClose,
  nextPath,
}: {
  open: boolean;
  onClose: () => void;
  nextPath: string;
}) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-[#0F2038] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-white/[0.10]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0085FC]/20">
            <span className="text-2xl">👤</span>
          </div>
        </div>
        <h2 className="text-center text-[20px] font-bold text-white mb-2">Completá tu perfil</h2>
        <p className="text-center text-sm text-white/55 leading-relaxed mb-6">
          Para reservar o unirte a partidos, el club necesita saber quién sos. Solo te lleva 1 minuto.
        </p>
        <Link
          href={`/completar-perfil?next=${encodeURIComponent(nextPath)}`}
          className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] py-3.5 text-sm font-bold text-white mb-3"
        >
          Completar mi perfil →
        </Link>
        <button
          onClick={onClose}
          className="w-full rounded-2xl border border-white/15 bg-white/[0.06] py-3 text-sm font-semibold text-white/70"
        >
          Ahora no
        </button>
      </div>
    </div>,
    document.body
  );
}

type DrawerItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

const accountItems: DrawerItem[] = [
  { href: "/perfil", label: "Perfil", icon: User },
  { href: "/comunidad", label: "Comunidad", icon: Users },
  { href: "/perfil/editar", label: "Editar perfil", icon: User },
  { href: "/perfil/pagos", label: "Tus pagos", icon: CreditCard },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

const supportItems: DrawerItem[] = [
  { href: "/sobre-padelibre", label: "Un poco más de PadeLibre", icon: Sparkles },
  { href: "/ayuda", label: "Chat Bot", icon: CircleHelp },
  { href: "/como-funciona", label: "Cómo funciona", icon: FileText },
  { href: "/legal/terminos", label: "Condiciones de uso", icon: Shield },
  { href: "/legal/privacidad", label: "Política de privacidad", icon: FileText },
];

function ClubPageDrawer({
  open,
  onClose,
  playerName,
}: {
  open: boolean;
  onClose: () => void;
  playerName: string;
  slug: string;
}) {
  const router = useRouter();
  const [signOutBusy, setSignOutBusy] = useState(false);

  if (!open || typeof document === "undefined") return null;

  const initial = (playerName.trim()[0] ?? "J").toUpperCase();

  async function handleSignOut() {
    setSignOutBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[ClubPageDrawer] sign out failed", err);
    } finally {
      onClose();
      router.replace("/login");
      router.refresh();
    }
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Cerrar menú"
        className="fixed inset-0 z-[75] bg-black/40"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        className="fixed right-0 z-[76] flex w-80 max-w-[85vw] flex-col overflow-hidden shadow-2xl"
        style={{ top: 0, height: "100dvh", backgroundColor: "#0F2038" }}
      >
        <div
          className="shrink-0 border-b border-white/15 p-5"
          style={{ background: "linear-gradient(135deg, #0085FC 0%, #0461C4 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white ring-2 ring-white/50">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold text-white">{playerName || "Jugador"}</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <p className="px-4 py-2 text-xs uppercase tracking-widest text-white/35">MI CUENTA</p>
          {accountItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 border-b border-[#1A3050] px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.04]"
              >
                <span className="rounded-full bg-white/[0.06] p-2 text-white">
                  <Icon size={16} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <p className="px-4 py-2 text-xs uppercase tracking-widest text-white/35">SOPORTE</p>
          {supportItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 border-b border-[#1A3050] px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.04]"
              >
                <span className="rounded-full bg-white/[0.06] p-2 text-white">
                  <Icon size={16} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div
          className="shrink-0 border-t border-[#1A3050] px-4 pt-2"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <Link
            href="/home"
            onClick={onClose}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold text-[#0085FC]"
          >
            ← Volver a PadeLibre
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signOutBusy}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-sm font-medium text-red-400 transition hover:bg-red-950/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="rounded-full bg-white/[0.06] p-2 text-red-400">
              <LogOut size={16} />
            </span>
            <span>{signOutBusy ? "Cerrando sesión…" : "Cerrar sesión"}</span>
          </button>
        </div>
      </aside>
    </>,
    document.body
  );
}

export default function ClubPublicPage({ club, courts, isLoggedIn, playerName, profileComplete }: Props) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showIncompleteProfile, setShowIncompleteProfile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const firstName = playerName.trim().split(" ")[0] || "vos";

  const cityProvince = [club.city, club.province]
    .filter((v): v is string => Boolean(v?.trim()))
    .map((v) => v.trim().toUpperCase())
    .join(" · ");

  const services = (club.services ?? []).filter(Boolean);
  const socialLinks = [
    { key: "instagram", href: instagramHref(club.instagram), Icon: InstagramIcon, label: "Instagram" },
    { key: "whatsapp", href: whatsappHref(club.whatsapp), Icon: WhatsappIcon, label: "WhatsApp" },
    { key: "facebook", href: facebookHref(club.facebook), Icon: FacebookIcon, label: "Facebook" },
    { key: "tiktok", href: tiktokHref(club.tiktok), Icon: TiktokIcon, label: "TikTok" },
  ].filter((s) => s.href);

  const courtCount = courts.length;

  return (
    <main className={`min-h-dvh ${spaceGrotesk.className}`} style={{ backgroundColor: "#0A1628" }}>
      <div className="h-0.5 w-full" style={{ backgroundColor: "#CCFF00" }} />

      <div className="relative mx-auto w-full max-w-[480px]">
        <nav className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4">
          <Link href={isLoggedIn ? "/home" : `/login?next=/${club.slug}`}>
            <Image src="/logo.png" alt="PadeLibre" width={24} height={24} className="rounded-md" />
          </Link>
          {!isLoggedIn ? (
            <Link
              href={`/login?next=/${club.slug}`}
              className="rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
            >
              Iniciar sesión
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white"
            >
              <Menu size={20} />
            </button>
          )}
        </nav>

        <section className="relative h-[320px] w-full overflow-hidden">
          {club.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.cover_image_url} alt={club.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ backgroundColor: "#0F2038" }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628] via-[#0A1628]/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-6">
            <div className="mb-3 h-16 w-16 overflow-hidden rounded-2xl bg-white/10">
              {club.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <h1 className="ml-1 border-l-[3px] border-[#CCFF00] pl-3 text-[26px] font-bold leading-tight text-white">
              {club.name}
            </h1>
            {cityProvince ? (
              <p className="ml-4 mt-1 text-[12px] uppercase tracking-wider text-white/55">{cityProvince}</p>
            ) : null}
            <div className="ml-4 mt-3">
              {isLoggedIn ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: "#CCFF00", color: "#0A1628" }}
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: "#0A1628" }} />
                  {courtCount} {courtCount === 1 ? "cancha libre" : "canchas libres"} ahora
                </span>
              ) : (
                <span className="text-xs text-white/40">
                  {courtCount} {courtCount === 1 ? "cancha" : "canchas"}
                </span>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className={`mx-auto w-full max-w-[480px] ${isLoggedIn ? "pb-20" : "pb-36"}`}>
        {isLoggedIn ? (
          <div className="px-4 pb-1 pt-5">
            <p className="text-[13px] font-medium text-white/50">Hola, {firstName} 👋</p>
            <p className="mt-0.5 text-[20px] font-bold leading-tight text-white">¿Qué hacemos hoy?</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 px-4 pb-0 pt-4">
          {isLoggedIn ? (
            profileComplete ? (
              <>
                <Link
                  href={`/${club.slug}/reservar`}
                  className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-base font-bold text-white"
                >
                  🎾 Reservar una cancha
                </Link>
                <Link
                  href={`/${club.slug}/partidos`}
                  className="flex h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-sm font-semibold text-white"
                >
                  🏆 Abrir o unirse a un partido
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowIncompleteProfile(true)}
                  className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-base font-bold text-white"
                >
                  🎾 Reservar una cancha
                </button>
                <button
                  type="button"
                  onClick={() => setShowIncompleteProfile(true)}
                  className="flex h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-sm font-semibold text-white"
                >
                  🏆 Abrir o unirse a un partido
                </button>
              </>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-base font-bold text-white"
              >
                🎾 Reservar una cancha
              </button>
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-sm font-semibold text-white"
              >
                🏆 Abrir o unirse a un partido
              </button>
            </>
          )}
        </div>

        <div className="px-4">
          {!isLoggedIn ? (
            <section className="mt-6 border-t border-[#1A3050] pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">Cómo funciona</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {HOW_IT_WORKS.map((item) => (
                  <div
                    key={item.title}
                    className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.04] p-3"
                  >
                    <span className="text-[18px] leading-none">{item.emoji}</span>
                    <p className="text-[12px] font-bold text-white">{item.title}</p>
                    <p className="text-[10px] leading-relaxed text-white/45">{item.subtitle}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6 border-t border-[#1A3050] pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">Sobre el club</p>
            {club.description ? (
              <p className="mt-3 text-sm leading-relaxed text-white/65">{club.description}</p>
            ) : null}
            {club.business_hours ? (
              <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/55">
                ⏰ {club.business_hours}
              </span>
            ) : null}
          </section>

          {courts.length > 0 ? (
            <section className="mt-6 border-t border-[#1A3050] pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                Canchas · {courts.length}
              </p>
              <div className="mt-3">
                {courts.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 border-b border-[#1A3050] py-3 last:border-0">
                    <span className="w-6 shrink-0 font-mono text-[11px] text-[#CCFF00]/40">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-white">{c.name ?? "Cancha"}</p>
                      <p className="text-xs text-white/45">
                        {formatSurface(c.surface)} · {c.indoor ? "🏠" : "☀️"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {isLoggedIn ? (
                <Link href={`/${club.slug}/reservar`} className="mt-3 inline-block text-sm font-semibold text-[#0085FC]">
                  Ver disponibilidad →
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="mt-3 text-left text-sm font-semibold text-[#0085FC]"
                >
                  Ver disponibilidad →
                </button>
              )}
            </section>
          ) : null}

          {services.length > 0 ? (
            <section className="mt-6 border-t border-[#1A3050] pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">Servicios</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {services.map((s) => {
                  const meta = SERVICES_CATALOG[s.toLowerCase()] ?? { emoji: "🎾", label: s };
                  return (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/70"
                    >
                      <span className="text-sm">{meta.emoji}</span>
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            </section>
          ) : null}

          {socialLinks.length > 0 ? (
            <section className="mt-6 border-t border-[#1A3050] pt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">Encontranos en</p>
              <div className="mt-4 flex gap-3">
                {socialLinks.map(({ key, href, Icon, label }) => (
                  <a
                    key={key}
                    href={href ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.06] text-white">
                      <Icon />
                    </span>
                    <span className="text-[10px] text-white/40">{label}</span>
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

      <IncompleteProfileModal
        open={showIncompleteProfile}
        onClose={() => setShowIncompleteProfile(false)}
        nextPath={`/${club.slug}`}
      />

      {isLoggedIn ? (
        <ClubPageDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          playerName={playerName}
          slug={club.slug}
        />
      ) : null}

      {!isLoggedIn ? (
        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-[#1A3050]"
          style={{ backgroundColor: "#0A1628", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto w-full max-w-[480px] px-4 pt-3">
            <p className="mb-2 text-center text-xs text-white/50">Para reservar necesitás una cuenta</p>
            <div className="flex gap-2">
              <Link
                href={`/login?next=/${club.slug}`}
                className="flex-1 rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] py-3 text-center text-sm font-bold text-white"
              >
                Crear cuenta gratis
              </Link>
              <Link
                href={`/login?next=/${club.slug}`}
                className="flex-1 rounded-2xl border border-white/15 py-3 text-center text-sm font-semibold text-white"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
