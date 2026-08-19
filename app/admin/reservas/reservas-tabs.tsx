"use client";

import { useState } from "react";
import { adminCTAPrimary, adminEmptyState } from "@/components/admin/admin-premium";
import OpenMatchCard from "./open-match-card";
import OpenMatchModal from "./open-match-modal";
import ManagePlayersModal from "./manage-players-modal";

export type OpenMatchParticipant = {
  id: string;
  playerId: string | null;
  team: 1 | 2 | null;
  name: string;
  avatarUrl: string | null;
};

export type OpenMatchData = {
  id: string;
  scheduledDate: string;
  scheduledTime: string;
  courtName: string;
  genderCategory: "masculino" | "femenino" | "mixto" | null;
  categoryRange: string[];
  createdByClub: boolean;
  participants: OpenMatchParticipant[];
};

export type ReservasCourtOption = { id: string; name: string };

type Tab = "reservas" | "partidos";

export default function ReservasTabs({
  children,
  openMatches,
  courts,
  clubId,
  clubName,
}: {
  children: React.ReactNode;
  openMatches: OpenMatchData[];
  courts: ReservasCourtOption[];
  clubId: string;
  clubName: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("reservas");
  const [showOpenMatchModal, setShowOpenMatchModal] = useState(false);
  const [manageMatch, setManageMatch] = useState<OpenMatchData | null>(null);

  return (
    <>
      <div className="flex rounded-2xl border border-[var(--admin-card-border)] bg-[var(--bg-subtle)] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("reservas")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
            activeTab === "reservas"
              ? "bg-[var(--admin-card-bg)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-tertiary)]"
          }`}
        >
          Reservas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("partidos")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
            activeTab === "partidos"
              ? "bg-[var(--admin-card-bg)] text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-tertiary)]"
          }`}
        >
          Partidos abiertos
          {openMatches.length > 0 ? (
            <span className="ml-1.5 rounded-full bg-[#0085FC] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {openMatches.length}
            </span>
          ) : null}
        </button>
      </div>

      <div className={activeTab === "reservas" ? "flex flex-col gap-6" : "hidden"}>{children}</div>

      {activeTab === "partidos" ? (
        <div className="flex flex-col gap-4">
          <button type="button" onClick={() => setShowOpenMatchModal(true)} className={`${adminCTAPrimary} self-start`}>
            + Abrir partido
          </button>

          {openMatches.length === 0 ? (
            <div className={adminEmptyState}>No hay partidos abiertos activos.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {openMatches.map((match) => (
                <OpenMatchCard key={match.id} match={match} onAddPlayer={() => setManageMatch(match)} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {showOpenMatchModal ? (
        <OpenMatchModal
          clubId={clubId}
          clubName={clubName}
          courts={courts}
          onClose={() => setShowOpenMatchModal(false)}
        />
      ) : null}

      {manageMatch ? <ManagePlayersModal match={manageMatch} onClose={() => setManageMatch(null)} /> : null}
    </>
  );
}
