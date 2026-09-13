"use client";

import { useState, type ReactNode } from "react";
import { EvaluationCalendar } from "./evaluation-calendar";
import type { EvaluationPoolItem } from "@/lib/evaluation-agenda";

const SUB_TABS = [
  { key: "calendario", label: "Calendário" },
  { key: "triagens", label: "Entrada via WhatsApp" },
  { key: "acolhimentos", label: "Planilha de Pacientes" },
] as const;
type SubTabKey = (typeof SUB_TABS)[number]["key"];

function SubTabBadge({ value, urgent }: { value: number; urgent?: boolean }) {
  if (!value) return null;
  return (
    <span
      className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${urgent ? "animate-pulse bg-status-negative text-white" : "bg-paper text-ink"}`}
    >
      {value}
    </span>
  );
}

/**
 * Aba "Agenda 1ª Avaliação" do painel de coordenação — calendário semanal
 * único de 1ª avaliação/anamnese/acolhimento, independente de onde o
 * paciente veio (WhatsApp/anamnese, PDF de convênio, presencial pela
 * Recepção). A aprovação de documentos continua em telas próprias — esta
 * aba só concentra o agendamento em si.
 *
 * "Planilha de Pacientes" (ex-aba própria na barra rosa) virou a 3ª sub-aba
 * daqui (13/09/2026) — ela e "Entrada via WhatsApp" são etapas do mesmo
 * funil de 1ª avaliação e viviam em profundidades de navegação diferentes,
 * confundindo o supervisor sobre onde cada uma ficava.
 */
export function AgendaAvaliacoesPanel({
  pool,
  therapists,
  rooms,
  triagensPanel,
  acolhimentosPanel,
  acolhimentosCount = 0,
  acolhimentosUrgent = false,
}: {
  pool: EvaluationPoolItem[];
  therapists: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  triagensPanel: ReactNode;
  acolhimentosPanel: ReactNode;
  acolhimentosCount?: number;
  acolhimentosUrgent?: boolean;
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
              className="flex items-center rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{
                background: subTab === t.key ? "var(--color-accent)" : "transparent",
                color: subTab === t.key ? "var(--color-bg)" : "var(--color-ink-soft, inherit)",
              }}
            >
              {t.label}
              {t.key === "acolhimentos" ? <SubTabBadge value={acolhimentosCount} urgent={acolhimentosUrgent} /> : null}
            </button>
          ))}
        </nav>
      </div>

      {subTab === "triagens" ? triagensPanel : null}
      {subTab === "acolhimentos" ? acolhimentosPanel : null}
      {subTab === "calendario" ? <EvaluationCalendar pool={pool} therapists={therapists} rooms={rooms} /> : null}
    </div>
  );
}
