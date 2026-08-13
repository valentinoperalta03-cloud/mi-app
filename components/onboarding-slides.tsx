"use client";

import { useCallback, useState, type ReactNode, type TouchEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LocationSelectorOnboarding } from "@/components/LocationSelectorOnboarding";
import { DEFAULT_USER_LOCATION, type LocationSelection } from "@/lib/location-data";
import { saveUserLocationToProfile } from "@/lib/locations";

const BLUE = "#0085FC";
const BLUE_DARK = "#0461C4";
const BLUE_GLOW = "rgba(5,133,252,0.35)";

type IconName =
  | "padel"
  | "calendar"
  | "card"
  | "court"
  | "chart"
  | "trophy"
  | "star"
  | "users"
  | "chat"
  | "pin"
  | "bracket"
  | "medal"
  | "check"
  | "arrow";

function Icon({ name, size = 32, color = "#fff" }: { name: IconName; size?: number; color?: string }) {
  const icons: Record<IconName, ReactNode> = {
    padel: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="9" r="6" />
        <line x1="13.5" y1="13.5" x2="20" y2="20" />
        <line x1="20" y1="20" x2="22" y2="18" />
        <circle cx="9" cy="9" r="2" fill={color} fillOpacity=".3" />
      </svg>
    ),
    calendar: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <rect x="7" y="13" width="3" height="3" rx="0.5" fill={color} />
        <rect x="14" y="13" width="3" height="3" rx="0.5" fill={color} fillOpacity=".5" />
      </svg>
    ),
    card: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <rect x="2" y="5" width="20" height="14" rx="3" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="6" y1="15" x2="10" y2="15" />
      </svg>
    ),
    court: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="7" y1="4" x2="7" y2="20" strokeOpacity=".4" />
        <line x1="17" y1="4" x2="17" y2="20" strokeOpacity=".4" />
      </svg>
    ),
    chart: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <polyline points="3 17 8 11 13 14 19 7" />
        <line x1="3" y1="20" x2="21" y2="20" />
        <circle cx="19" cy="7" r="2" fill={color} />
      </svg>
    ),
    trophy: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <path d="M6 2h12v8a6 6 0 01-12 0V2z" />
        <path d="M6 6H3a2 2 0 000 4h3" />
        <path d="M18 6h3a2 2 0 010 4h-3" />
        <line x1="12" y1="16" x2="12" y2="20" />
        <line x1="8" y1="20" x2="16" y2="20" />
      </svg>
    ),
    star: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} fillOpacity=".8" stroke={color} strokeWidth="1.5" strokeLinecap="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    users: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
        <circle cx="18" cy="7" r="3" strokeOpacity=".6" />
        <path d="M21 21v-1.5a3 3 0 00-2-2.8" strokeOpacity=".6" />
      </svg>
    ),
    chat: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        <line x1="8" y1="10" x2="16" y2="10" strokeOpacity=".6" />
        <line x1="8" y1="14" x2="12" y2="14" strokeOpacity=".4" />
      </svg>
    ),
    pin: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" fill={color} fillOpacity=".3" />
      </svg>
    ),
    bracket: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <rect x="2" y="4" width="6" height="3" rx="1" />
        <rect x="2" y="11" width="6" height="3" rx="1" />
        <rect x="2" y="17" width="6" height="3" rx="1" />
        <line x1="8" y1="5.5" x2="13" y2="5.5" />
        <line x1="8" y1="12.5" x2="13" y2="12.5" />
        <line x1="13" y1="5.5" x2="13" y2="12.5" />
        <line x1="13" y1="9" x2="16" y2="9" />
        <line x1="8" y1="18.5" x2="16" y2="18.5" />
        <line x1="16" y1="9" x2="16" y2="18.5" />
        <line x1="16" y1="13.5" x2="19" y2="13.5" />
        <rect x="19" y="12" width="3" height="3" rx="0.5" fill={color} fillOpacity=".4" />
      </svg>
    ),
    medal: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="15" r="6" />
        <path d="M8.5 2.5l-2 4 5.5 2 5.5-2-2-4z" />
        <text x="12" y="19" textAnchor="middle" fontSize="7" fill={color} stroke="none" fontWeight="bold">
          1
        </text>
      </svg>
    ),
    check: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    arrow: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="13 6 19 12 13 18" />
      </svg>
    ),
  };
  return icons[name] ?? null;
}

function PadelibreLogo({ size = 56, showText = true, textSize = "text-2xl" }: { size?: number; showText?: boolean; textSize?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          overflow: "hidden",
          boxShadow: `0 8px 32px ${BLUE_GLOW}`,
          flexShrink: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6px" }} alt="Padelibre" />
      </div>
      {showText ? (
        <span
          className={`${textSize} font-bold tracking-tight`}
          style={{
            fontFamily: "'Outfit', sans-serif",
            color: "#fff",
            letterSpacing: "-0.03em",
          }}
        >
          Pade<span style={{ opacity: 0.4 }}>libre</span>
        </span>
      ) : null}
    </div>
  );
}

function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ width: i === current ? 24 : 8, opacity: i === current ? 1 : 0.35 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{
            height: 8,
            borderRadius: 4,
            background: i === current ? BLUE : "#fff",
          }}
        />
      ))}
    </div>
  );
}

function IconCard({ icon, label, delay = 0 }: { icon: IconName; label: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 20,
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        backdropFilter: "blur(12px)",
        flex: 1,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "linear-gradient(135deg, rgba(5,133,252,0.4) 0%, rgba(4,97,196,0.4) 100%)",
          border: "1px solid rgba(5,133,252,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(5,133,252,0.2)",
        }}
      >
        <Icon name={icon} size={26} color="#fff" />
      </div>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 500, textAlign: "center", lineHeight: 1.3 }}>
        {label}
      </span>
    </motion.div>
  );
}

function EloBar({
  label,
  value,
  max = 8,
  delay = 0,
  color = BLUE,
}: {
  label: string;
  value: number;
  max?: number;
  delay?: number;
  color?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.4 }} style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, color: "#fff", fontWeight: 700, fontFamily: "'Outfit',sans-serif" }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 8, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(value / max) * 100}%` }}
          transition={{ delay: delay + 0.2, duration: 0.7, ease: "easeOut" }}
          style={{
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${BLUE})`,
            borderRadius: 4,
            boxShadow: "0 0 8px rgba(5,133,252,0.6)",
          }}
        />
      </div>
    </motion.div>
  );
}

function ClubCard({ name, city, delay = 0 }: { name: string; city: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 16,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${BLUE}44, ${BLUE_DARK}44)`,
          border: `1px solid ${BLUE}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="court" size={22} color={BLUE} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 2, fontFamily: "'Outfit',sans-serif" }}>{name}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="pin" size={12} color="rgba(255,255,255,0.45)" />
          {city}
        </div>
      </div>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${BLUE}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="arrow" size={14} color={BLUE} />
      </div>
    </motion.div>
  );
}

const SLIDES = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

function SlideContent({
  id,
  onLocationSelect,
}: {
  id: number;
  onLocationSelect: (location: LocationSelection) => void;
}) {
  switch (id) {
    case 0:
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 24px", flex: 1, justifyContent: "center" }}>
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ marginBottom: 32 }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 32,
                overflow: "hidden",
                boxShadow: `0 20px 60px ${BLUE_GLOW}, 0 0 0 1px rgba(255,255,255,0.1)`,
                margin: "0 auto",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6px" }} alt="Padelibre" />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.18em",
                color: BLUE,
                textTransform: "uppercase",
                marginBottom: 14,
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              Padelibre
            </div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                marginBottom: 16,
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              Bienvenido a<br />
              <span
                style={{
                  background: "linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                PadeLibre
              </span>
            </h1>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 36, maxWidth: 300, margin: "0 auto 36px" }}>
              El pádel que querés jugar,
              <br />
              sin el caos de organizarlo.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}
          >
            {["Reservá canchas", "Armá partidos", "Encontrá jugadores", "Torneos"].map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                style={{
                  background: "rgba(5,133,252,0.15)",
                  border: "1px solid rgba(5,133,252,0.35)",
                  borderRadius: 100,
                  padding: "8px 16px",
                  fontSize: 13,
                  color: "#fff",
                  fontWeight: 500,
                }}
              >
                {f}
              </motion.div>
            ))}
          </motion.div>
        </div>
      );

    case 1:
      return (
        <div style={{ padding: "0 24px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: BLUE, textTransform: "uppercase", marginBottom: 10, fontFamily: "'Outfit',sans-serif" }}>
              Partidos
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>
              Reservá o unite
              <br />
              en segundos
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 28 }}>
              Elegí el club, la cancha y el horario. Pagás solo tu parte — sin transferirle a nadie.
            </p>
          </motion.div>

          <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
            <IconCard icon="calendar" label="Reservá el turno" delay={0.15} />
            <IconCard icon="court" label="Elegí la cancha" delay={0.25} />
            <IconCard icon="card" label="Cada uno paga lo suyo" delay={0.35} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            style={{
              background: "rgba(5,133,252,0.12)",
              border: "1px solid rgba(5,133,252,0.3)",
              borderRadius: 20,
              padding: "18px 20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: "'Outfit',sans-serif" }}>Tu club favorito</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Sábado · 18:00 · $X.XXX por jugador</div>
              </div>
              <div
                style={{
                  background: BLUE,
                  borderRadius: 10,
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  fontFamily: "'Outfit',sans-serif",
                }}
              >
                $X.XXX
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Vos", "?", "?", "?"].map((p, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 10,
                    background: i === 0 ? `${BLUE}33` : "rgba(255,255,255,0.05)",
                    border: `1px solid ${i === 0 ? `${BLUE}55` : "rgba(255,255,255,0.1)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: i === 0 ? 12 : 18,
                    color: i === 0 ? "#fff" : "rgba(255,255,255,0.2)",
                    fontWeight: i === 0 ? 600 : 400,
                  }}
                >
                  {p}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      );

    case 2:
      return (
        <div style={{ padding: "0 24px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: BLUE, textTransform: "uppercase", marginBottom: 10, fontFamily: "'Outfit',sans-serif" }}>
              Nivel real
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>
              Tu nivel se mide
              <br />
              de verdad
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 28 }}>
              Jugás en tu categoría real, de 8va a 1ra. Elegís tu nivel al empezar y jugás partidos parejos.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "20px",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>Tu categoría actual</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", fontFamily: "'Outfit',sans-serif", letterSpacing: "-0.04em" }}>
                  5ta
                </div>
              </div>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${BLUE}33, ${BLUE_DARK}33)`,
                  border: `1px solid ${BLUE}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="trophy" size={26} color={BLUE} />
              </div>
            </div>

            <EloBar label="Servicio" value={5.8} delay={0.3} />
            <EloBar label="Consistencia" value={6.1} delay={0.4} />
            <EloBar label="Táctica" value={4.9} delay={0.5} />
          </motion.div>

          <div style={{ display: "flex", gap: 10 }}>
            <IconCard icon="chart" label="Evolución partido a partido" delay={0.55} />
            <IconCard icon="star" label="Ranking por ciudad" delay={0.65} />
          </div>
        </div>
      );

    case 3:
      return (
        <div style={{ padding: "0 24px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: BLUE, textTransform: "uppercase", marginBottom: 10, fontFamily: "'Outfit',sans-serif" }}>
              Comunidad
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>
              Encontrá jugadores
              <br />y clubes
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 24 }}>
              Seguí jugadores, chateá con tu equipo y explorá los mejores clubes cerca tuyo.
            </p>
          </motion.div>

          <ClubCard name="Club Pádel Centro" city="Tu ciudad" delay={0.2} />
          <ClubCard name="Padel Norte" city="Cerca tuyo" delay={0.3} />

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <IconCard icon="users" label="Seguí jugadores" delay={0.4} />
            <IconCard icon="chat" label="Chat de equipo" delay={0.5} />
            <IconCard icon="pin" label="Clubes cerca tuyo" delay={0.6} />
          </div>
        </div>
      );

    case 4:
      return (
        <div style={{ padding: "0 24px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: BLUE, textTransform: "uppercase", marginBottom: 10, fontFamily: "'Outfit',sans-serif" }}>
              Torneos
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: 12, fontFamily: "'Outfit',sans-serif" }}>
              Competí en
              <br />
              torneos
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, marginBottom: 24 }}>
              Americano, eliminación directa o por grupos. Fixture, resultados y campeón desde la app.
            </p>
          </motion.div>

          {[
            { icon: "users" as IconName, title: "Americano", desc: "Todos contra todos. Suma puntos." },
            { icon: "bracket" as IconName, title: "Eliminación directa", desc: "Perdés → salís. Solo los mejores avanzan." },
            { icon: "trophy" as IconName, title: "Grupos + Eliminación", desc: "Fase de grupos y llaves finales." },
          ].map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 16,
                padding: "14px 16px",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${BLUE}22`,
                  border: `1px solid ${BLUE}33`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={t.icon} size={22} color={BLUE} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 2, fontFamily: "'Outfit',sans-serif" }}>{t.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{t.desc}</div>
              </div>
            </motion.div>
          ))}

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <IconCard icon="medal" label="Resultados en vivo" delay={0.65} />
            <IconCard icon="star" label="Campeón del torneo" delay={0.75} />
          </motion.div>
        </div>
      );

    case 5:
      return <LocationSelectorOnboarding onLocationSelect={onLocationSelect} />;

    default:
      return null;
  }
}

export function OnboardingSlides({ onComplete }: { onComplete?: () => void }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [userLocation, setUserLocation] = useState<LocationSelection | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const total = SLIDES.length;

  const handleLocationSelect = useCallback((location: LocationSelection) => {
    setUserLocation(location);
  }, []);

  const goNext = async () => {
    if (current < total - 1) {
      setDirection(1);
      setCurrent((c) => c + 1);
      return;
    }

    setSavingLocation(true);
    try {
      await saveUserLocationToProfile(userLocation ?? DEFAULT_USER_LOCATION);
    } catch (err) {
      console.error("Error guardando ubicación:", err);
    } finally {
      setSavingLocation(false);
      onComplete?.();
    }
  };

  const goBack = () => {
    if (current > 0) {
      setDirection(-1);
      setCurrent((c) => c - 1);
    }
  };

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStart === null) return;
    const delta = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) {
      if (delta > 0) goNext();
      else goBack();
    }
    setTouchStart(null);
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  const isLast = current === total - 1;

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');`}</style>

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          width: "100%",
          maxWidth: 430,
          height: "100dvh",
          minHeight: 700,
          margin: "0 auto",
          position: "relative",
          overflow: "hidden",
          fontFamily: "'Outfit', sans-serif",
          background: "linear-gradient(160deg, #020D1F 0%, #040F24 40%, #061430 100%)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-10%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 300,
            height: 300,
            background: "radial-gradient(circle, rgba(5,133,252,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "15%",
            right: "-20%",
            width: 250,
            height: 250,
            background: "radial-gradient(circle, rgba(4,97,196,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "52px 24px 16px",
            position: "relative",
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <PadelibreLogo size={36} textSize="text-lg" />
          <button
            type="button"
            onClick={() => onComplete?.()}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 100,
              padding: "6px 16px",
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontFamily: "'Outfit',sans-serif",
              fontWeight: 500,
            }}
          >
            Saltar
          </button>
        </div>

        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={current}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <SlideContent id={current} onLocationSelect={handleLocationSelect} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div
          style={{
            padding: "16px 24px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            position: "relative",
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <Dots total={total} current={current} />

          <div style={{ display: "flex", gap: 12 }}>
            {current > 0 ? (
              <button
                type="button"
                onClick={goBack}
                style={{
                  flex: "0 0 56px",
                  height: 56,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="11 18 5 12 11 6" />
                </svg>
              </button>
            ) : null}

            <motion.button
              type="button"
              onClick={() => void goNext()}
              disabled={savingLocation}
              whileTap={{ scale: savingLocation ? 1 : 0.97 }}
              style={{
                flex: 1,
                height: 56,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_DARK} 100%)`,
                border: "none",
                cursor: savingLocation ? "wait" : "pointer",
                opacity: savingLocation ? 0.75 : 1,
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                fontFamily: "'Outfit',sans-serif",
                boxShadow: "0 8px 32px rgba(5,133,252,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {isLast ? (
                <>
                  <Icon name="check" size={18} color="#fff" />
                  {savingLocation ? "Guardando…" : "Empezar"}
                </>
              ) : (
                <>
                  Siguiente
                  <Icon name="arrow" size={18} color="#fff" />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </>
  );
}
