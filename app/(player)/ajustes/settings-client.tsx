"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Loader2, MapPin } from "lucide-react";

type ActionState = { ok: boolean; message: string };

type Props = {
  initialLocation: string | null;
  notificationsEnabled: boolean;
  isPublic: boolean;
  category: string | null;
  name: string;
  avatarUrl: string | null;
  levelDowngraded: boolean;
  updateLocationAction: (formData: FormData) => Promise<ActionState>;
  updateNotificationsAction: (formData: FormData) => Promise<ActionState>;
  updatePrivacyAction: (formData: FormData) => Promise<ActionState>;
  downgradeLevelAction: () => Promise<void>;
  changePasswordAction: (formData: FormData) => Promise<ActionState>;
  deleteAccountAction: () => Promise<void>;
};

const LEVEL_INFO = [
  "8va: Principiante, recién empezás",
  "7ma: Básico, controlás los golpes fundamentales",
  "6ta: Intermedio bajo, jugás partidos con regularidad",
  "5ta: Intermedio, buen manejo técnico y táctico",
  "4ta: Intermedio alto, jugás torneos amateurs",
  "3ra: Avanzado, nivel competitivo",
  "2da/1ra: Elite, nivel profesional o semi-profesional",
] as const;

export default function SettingsClient({
  initialLocation,
  notificationsEnabled,
  isPublic,
  category,
  name,
  avatarUrl,
  levelDowngraded,
  updateLocationAction,
  updateNotificationsAction,
  updatePrivacyAction,
  downgradeLevelAction,
  changePasswordAction,
  deleteAccountAction,
}: Props) {
  const [location, setLocation] = useState(initialLocation ?? "Sin ubicación");
  const [locationMsg, setLocationMsg] = useState<string>("");
  const [notifEnabled, setNotifEnabled] = useState(notificationsEnabled);
  const [privacyPublic, setPrivacyPublic] = useState(isPublic);
  const [notifMsg, setNotifMsg] = useState("");
  const [privacyMsg, setPrivacyMsg] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdOpen, setPwdOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pending, startTransition] = useTransition();

  async function detectLocation() {
    setLocationMsg("");
    if (!navigator.geolocation) {
      setLocationMsg("Tu dispositivo no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
          );
          const data = (await res.json()) as {
            address?: {
              city?: string;
              town?: string;
              village?: string;
              state?: string;
            };
          };
          const city = data.address?.city || data.address?.town || data.address?.village || "Sin ciudad";
          const state = data.address?.state || "Sin provincia";
          const composed = `${city}, ${state}`;
          const fd = new FormData();
          fd.set("location", composed);
          const result = await updateLocationAction(fd);
          if (result.ok) {
            setLocation(composed);
          }
          setLocationMsg(result.message);
        } catch {
          setLocationMsg("No pudimos detectar la ubicación. Intentá nuevamente.");
        }
      },
      () => {
        setLocationMsg("Activá el GPS para detectar tu ubicación");
      }
    );
  }

  function toggleNotifications(next: boolean) {
    setNotifEnabled(next);
    setNotifMsg("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("enabled", String(next));
      const result = await updateNotificationsAction(fd);
      setNotifMsg(result.message);
      if (!result.ok) setNotifEnabled(!next);
    });
  }

  function togglePrivacy(next: boolean) {
    setPrivacyPublic(next);
    setPrivacyMsg("");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("is_public", String(next));
      const result = await updatePrivacyAction(fd);
      setPrivacyMsg(result.message);
      if (!result.ok) setPrivacyPublic(!next);
    });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-[var(--bg-app)] px-4 pb-24 pt-6">
      <header className="rounded-2xl bg-gradient-to-r from-[#0585FC] to-cyan-500 px-4 py-4 text-white">
        <p className="text-xs uppercase tracking-widest text-sky-100">Ajustes</p>
        <h1 className="text-2xl font-bold">Configuración</h1>
      </header>

      {levelDowngraded ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          Tu nivel fue actualizado correctamente.
        </div>
      ) : null}

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Mi cuenta</h2>

        <div className="mt-4 space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Ubicación (obligatoria)</p>
          <p className="text-sm text-[var(--text-tertiary)]">{location}</p>
          <button
            type="button"
            onClick={detectLocation}
            className="btn-primary-gradient inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold"
          >
            <MapPin size={16} />
            Detectar mi ubicación
          </button>
          {locationMsg ? <p className="text-xs text-[var(--text-tertiary)]">{locationMsg}</p> : null}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] p-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Notificaciones</p>
            <p className="text-xs text-[var(--text-tertiary)]">Recibí avisos de partidos y reservas</p>
          </div>
          <button
            type="button"
            onClick={() => toggleNotifications(!notifEnabled)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              notifEnabled ? "bg-emerald-100 text-emerald-700" : "bg-[var(--bg-subtle)] text-[var(--text-tertiary)]"
            }`}
          >
            {notifEnabled ? "ON" : "OFF"}
          </button>
        </div>
        {notifMsg ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">{notifMsg}</p> : null}

        <div className="mt-3 flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] p-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Privacidad</p>
            <p className="text-xs text-[var(--text-tertiary)]">{privacyPublic ? "Perfil público" : "Perfil privado"}</p>
          </div>
          <button
            type="button"
            onClick={() => togglePrivacy(!privacyPublic)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              privacyPublic ? "bg-emerald-100 text-emerald-700" : "bg-[var(--bg-subtle)] text-[var(--text-tertiary)]"
            }`}
          >
            {privacyPublic ? "Público" : "Privado"}
          </button>
        </div>
        {privacyMsg ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">{privacyMsg}</p> : null}
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--text-primary)]">Mi nivel</h2>
          <p className="rounded-full bg-[#0585FC]/10 px-3 py-1 text-xs font-semibold text-[#0461C4]">{category || "—"}</p>
        </div>
        <button
          type="button"
          onClick={() => setLevelOpen((v) => !v)}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-left text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          Ver detalle de categorías
          <ChevronDown size={16} className={levelOpen ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
        {levelOpen ? (
          <div className="mt-2 space-y-1 rounded-2xl bg-[var(--bg-subtle)] p-3 text-sm text-[var(--text-secondary)]">
            {LEVEL_INFO.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setShowDowngradeModal(true)}
          className="mt-3 w-full rounded-2xl border border-[var(--border-subtle)] bg-transparent py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          Bajar mi nivel
        </button>
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Seguridad</h2>
        <button
          type="button"
          onClick={() => setPwdOpen((v) => !v)}
          className="mt-3 w-full rounded-2xl border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-left text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          Cambiar contraseña
        </button>
        {pwdOpen ? (
          <form
            className="mt-3 space-y-2"
            action={(formData) =>
              startTransition(async () => {
                const result = await changePasswordAction(formData);
                setPwdMsg(result.message);
              })
            }
          >
            <input
              type="password"
              name="newPassword"
              minLength={6}
              required
              placeholder="Nueva contraseña"
              className="w-full rounded-xl border bg-[var(--bg-input)] border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[#0585FC] focus:outline-none focus:ring-2 focus:ring-[#0585FC]/20"
            />
            <input
              type="password"
              name="confirmPassword"
              minLength={6}
              required
              placeholder="Confirmar contraseña"
              className="w-full rounded-xl border bg-[var(--bg-input)] border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[#0585FC] focus:outline-none focus:ring-2 focus:ring-[#0585FC]/20"
            />
            <button
              type="submit"
              className="btn-primary-gradient w-full rounded-2xl py-2 text-sm font-semibold"
            >
              Guardar nueva contraseña
            </button>
          </form>
        ) : null}
        {pwdMsg ? <p className="mt-2 text-xs text-[var(--text-tertiary)]">{pwdMsg}</p> : null}
      </section>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Cuenta</h2>
        <div className="mt-3 flex items-center gap-3">
          {avatarUrl?.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo de usuario
            <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0585FC]/50 text-sm font-bold text-white">
              {(name[0] ?? "J").toUpperCase()}
            </div>
          )}
          <p className="text-sm font-medium text-[var(--text-secondary)]">{name}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="mt-4 w-full rounded-2xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600"
        >
          Eliminar mi cuenta
        </button>
      </section>

      {showDowngradeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">¿Estás seguro? Tu nivel bajará un escalón.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDowngradeModal(false)}
                className="flex-1 rounded-2xl border border-[var(--border-subtle)] bg-transparent py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await downgradeLevelAction();
                  })
                }
                className="flex-1 rounded-2xl bg-amber-500 py-2 text-sm font-semibold text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Esta acción es irreversible.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-2xl border border-[var(--border-subtle)] bg-transparent py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await deleteAccountAction();
                  })
                }
                className="btn-danger flex-1 rounded-2xl py-2 text-sm font-semibold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pending ? (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-[var(--text-primary)] px-3 py-1 text-xs text-white">
          <span className="inline-flex items-center gap-1">
            <Loader2 size={14} className="animate-spin" />
            Guardando...
          </span>
        </div>
      ) : null}
    </main>
  );
}
