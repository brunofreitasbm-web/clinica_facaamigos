"use client";

import { useState, type ReactNode } from "react";
import { EvaluationCalendar } from "./evaluation-calendar";
import type { EvaluationPoolItem } from "@/lib/evaluation-agenda";

const SUB_TABS = [
  { key: "calendario", label: "Calendário" },
  { key: "triagens", label: "Entrada via WhatsApp" },
] as const;
type SubTabKey = (typeof SUB_TABS)[number]["key"];

/**
 * Aba "Agenda 1ª Avaliação" do painel de coordenação — calendário semanal
 * único de 1ª avaliação/anamnese/acolhimento, independente de onde o
 * paciente veio (WhatsApp/anamnese, PDF de convênio, presencial pela
 * Recepção). A aprovação de documentos continua em telas próprias — esta
 * aba só concentra o agendamento em si.
 */
export function AgendaAvaliacoesPanel({
  pool,
  therapists,
  rooms,
  triagensPanel,
}: {
  pool: EvaluationPoolItem[];
  therapists: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  triagensPanel: ReactNode;
}) {
  const [subTab, setSubTab] = useState<SubTabKey>("calendario");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Agenda 1ª Avaliação</h2>
        <nav className="flex gap-1 rounded-lg border border-paper-line-strong bg-white p-1">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{
                background: subTab === t.key ? "var(--color-accent)" : "transparent",
                color: subTab === t.key ? "var(--color-bg)" : "var(--color-ink-soft, inherit)",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {subTab === "triagens" ? triagensPanel : <EvaluationCalendar pool={pool} therapists={therapists} rooms={rooms} />}
    </div>
  );
}
