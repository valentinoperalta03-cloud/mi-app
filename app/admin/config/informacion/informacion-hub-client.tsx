"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AdminFlashMessage from "@/components/admin/admin-flash-message";
import AdminPageHeader from "@/components/admin/admin-page-header";
import { adminCard, adminKicker, adminPressable } from "@/components/admin/admin-premium";
import ConfigCancellationForm from "../config-cancellation-form";
import ConfigClubLocationForm from "../config-club-location-form";
import ConfigClubPhotosForm from "../config-club-photos-form";
import ConfigClubContactForm from "./config-club-contact-form";
import ConfigClubIdentityForm from "./config-club-identity-form";
import ConfigClubSlugForm from "./config-club-slug-form";
import ConfigClubSocialsForm from "./config-club-socials-form";

type View = "hub" | "identidad" | "ubicacion" | "redes" | "configuracion";

export type InformacionHubClub = {
  name: string;
  description: string;
  address: string;
  contact_phone: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  business_hours: string;
  slug: string;
  logo_url: string;
  cover_image_url: string;
  gallery_image_1: string;
  gallery_image_2: string;
  gallery_image_3: string;
  gallery_image_4: string;
  cancellation_policy: string;
  cancellation_hours: number | null;
  location: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
};

export type InformacionHubFlash = {
  dataOk: boolean;
  dataErr: string;
  locationOk: boolean;
  locationErr: string;
  photosOk: boolean;
  photosErr: string;
  policyOk: boolean;
  policyErr: string;
};

export type InformacionHubClientProps = {
  clubId: string;
  clubShortId: string;
  club: InformacionHubClub;
  userEmail: string;
  flash: InformacionHubFlash;
};

const HUB_CARDS: Array<{ view: Exclude<View, "hub">; icon: string; title: string; description: string }> = [
  {
    view: "identidad",
    icon: "🏟️",
    title: "Identidad del club",
    description: "Nombre, descripción, logo, fotos y link público",
  },
  {
    view: "ubicacion",
    icon: "📍",
    title: "Ubicación y contacto",
    description: "Dirección, ciudad, provincia, teléfono y WhatsApp",
  },
  {
    view: "redes",
    icon: "📱",
    title: "Redes sociales",
    description: "Instagram, Facebook y TikTok del club",
  },
  {
    view: "configuracion",
    icon: "⚙️",
    title: "Configuración",
    description: "Política de cancelación y servicios del club",
  },
];

function flash(ok: boolean, err: string) {
  if (ok) return <AdminFlashMessage type="success" message="Cambios guardados correctamente." />;
  if (err) return <AdminFlashMessage type="error" message={err} />;
  return null;
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
    >
      <ChevronLeft size={16} /> Volver
    </button>
  );
}

export default function InformacionHubClient({ clubId, clubShortId, club, userEmail, flash: flashState }: InformacionHubClientProps) {
  const [view, setView] = useState<View>("hub");

  if (view === "identidad") {
    return <IdentidadView clubId={clubId} club={club} flashState={flashState} onBack={() => setView("hub")} />;
  }
  if (view === "ubicacion") {
    return <UbicacionView club={club} flashState={flashState} onBack={() => setView("hub")} />;
  }
  if (view === "redes") {
    return <RedesView clubId={clubId} club={club} onBack={() => setView("hub")} />;
  }
  if (view === "configuracion") {
    return <ConfiguracionView club={club} flashState={flashState} onBack={() => setView("hub")} />;
  }

  const clubName = club.name || "Club";

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        kicker="Configuración"
        title="Información del club"
        subtitle="Todo lo que los jugadores ven de tu club"
      />

      <div className={`${adminCard} flex items-center gap-4`}>
        {club.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={club.logo_url} alt={clubName} className="h-14 w-14 rounded-2xl object-cover ring-1 ring-[var(--border-subtle)]" />
        ) : (
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0085FC]/20 text-lg font-bold text-[#0461C4] dark:text-sky-300">
            {clubName.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-xl font-bold text-[var(--text-primary)]">{clubName}</p>
          <p className="truncate text-sm text-[var(--text-secondary)]">{userEmail}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--text-tertiary)]">ID del club: {clubShortId}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {HUB_CARDS.map((card) => (
          <button
            key={card.view}
            onClick={() => setView(card.view)}
            className={`${adminCard} ${adminPressable} flex flex-col gap-3 text-left`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0085FC]/10">
              <span className="text-2xl">{card.icon}</span>
            </div>
            <div>
              <p className="font-bold text-[var(--text-primary)]">{card.title}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{card.description}</p>
            </div>
            <p className="mt-auto text-sm font-semibold text-[#0085FC]">Editar →</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function IdentidadView({
  clubId,
  club,
  flashState,
  onBack,
}: {
  clubId: string;
  club: InformacionHubClub;
  flashState: InformacionHubFlash;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <BackButton onBack={onBack} />
      <AdminPageHeader kicker="Identidad" title="Identidad del club" />

      <div className={adminCard}>
        <p className={adminKicker}>Datos principales</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Nombre y descripción</p>
        {flash(flashState.dataOk, flashState.dataErr)}
        <div className="mt-4">
          <ConfigClubIdentityForm
            initial={{
              name: club.name,
              description: club.description,
              address: club.address,
              contact_phone: club.contact_phone,
              whatsapp: club.whatsapp,
              instagram: club.instagram,
              business_hours: club.business_hours,
            }}
          />
        </div>
      </div>

      <div className={adminCard}>
        <p className={adminKicker}>Link público</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Tu link en PadeLibre</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Compartí este link con tus jugadores para que reserven directo.
        </p>
        <div className="mt-4">
          <ConfigClubSlugForm clubId={clubId} initialSlug={club.slug} />
        </div>
      </div>

      <div className={adminCard}>
        <p className={adminKicker}>Fotos</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Logo, portada y galería</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Visibles para todos los jugadores en tu perfil público.
        </p>
        {flash(flashState.photosOk, flashState.photosErr)}
        <div className="mt-4">
          <ConfigClubPhotosForm
            clubId={clubId}
            initial={{
              logo_url: club.logo_url,
              cover_image_url: club.cover_image_url,
              gallery_image_1: club.gallery_image_1,
              gallery_image_2: club.gallery_image_2,
              gallery_image_3: club.gallery_image_3,
              gallery_image_4: club.gallery_image_4,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function UbicacionView({
  club,
  flashState,
  onBack,
}: {
  club: InformacionHubClub;
  flashState: InformacionHubFlash;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <BackButton onBack={onBack} />
      <AdminPageHeader kicker="Ubicación" title="Ubicación y contacto" />

      <div className={adminCard}>
        <p className={adminKicker}>Ubicación</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">¿Dónde está el club?</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Los jugadores solo verán tu club si están en la misma ciudad.
        </p>
        {flash(flashState.locationOk, flashState.locationErr)}
        <div className="mt-4">
          <ConfigClubLocationForm
            initial={{
              location: club.location,
              city: club.city,
              province: club.province,
              country: club.country,
            }}
          />
        </div>
      </div>

      <div className={adminCard}>
        <p className={adminKicker}>Contacto</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Teléfono y WhatsApp</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Los jugadores van a poder contactarte directamente.
        </p>
        {flash(flashState.dataOk, flashState.dataErr)}
        <div className="mt-4">
          <ConfigClubContactForm
            initial={{
              name: club.name,
              description: club.description,
              address: club.address,
              contact_phone: club.contact_phone,
              whatsapp: club.whatsapp,
              instagram: club.instagram,
              business_hours: club.business_hours,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function RedesView({ clubId, club, onBack }: { clubId: string; club: InformacionHubClub; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <BackButton onBack={onBack} />
      <AdminPageHeader kicker="Redes sociales" title="Redes sociales" />

      <div className={adminCard}>
        <p className={adminKicker}>Redes</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Tus redes sociales</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Se muestran en tu perfil público para que los jugadores te sigan.
        </p>
        <div className="mt-4">
          <ConfigClubSocialsForm
            clubId={clubId}
            initial={{
              instagram: club.instagram,
              facebook: club.facebook,
              tiktok: club.tiktok,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ConfiguracionView({
  club,
  flashState,
  onBack,
}: {
  club: InformacionHubClub;
  flashState: InformacionHubFlash;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <BackButton onBack={onBack} />
      <AdminPageHeader kicker="Configuración" title="Configuración del club" />

      <div className={adminCard}>
        <p className={adminKicker}>Cancelación</p>
        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">Política de cancelación</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Definí hasta cuándo los jugadores pueden cancelar con reembolso.
        </p>
        {flash(flashState.policyOk, flashState.policyErr)}
        <div className="mt-4">
          <ConfigCancellationForm initialPolicy={club.cancellation_policy} initialHours={club.cancellation_hours} />
        </div>
      </div>

      <Link href="/admin/config/servicios" className={`${adminCard} ${adminPressable} flex items-center justify-between gap-4`}>
        <div>
          <p className="font-bold text-[var(--text-primary)]">Servicios del club</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Configurá qué servicios ofrecés: vestuarios, estacionamiento, cafetería, etc.
          </p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-[var(--text-tertiary)]" />
      </Link>
    </div>
  );
}
