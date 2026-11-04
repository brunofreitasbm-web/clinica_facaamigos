"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { PatientPill, PillTone } from "@/lib/patient-pills-pure";

/** Cores minimalistas por tom: vermelho = agir hoje, âmbar = falta algo, azul = em andamento. */
const TONE_STYLE: Record<PillTone, { pill: string; dot: string }> = {
  urgent: {
    pill: "bg-status-negative-soft text-status-negative-text",
    dot: "bg-status-negative-text",
  },
  missing: {
    pill: "bg-status-pending-soft text-status-pending-text",
    dot: "bg-status-pending-text",
  },
  progress: {
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
    dot: "bg-sky-600 dark:bg-sky-400",
  },
};

export function PillChip({ pill, onClick }: { pill: PatientPill; onClick?: () => void }) {
  const tone = TONE_STYLE[pill.tone];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={pill.detail}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${tone.pill} focus:outline-none focus-visible:ring-2 focus-visible:ring-[#841B4D]`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      {pill.label}
    </button>
  );
}

export type PatientPanel = { id: string; label: string; node: ReactNode };

/**
 * Diálogo "Pendências do paciente": o que falta (pílulas com detalhe) e, quando
 * existe, o painel de ação de cada item que antes vivia na tela Pendências
 * (resolver falta, renovar guia, remarcar, pedir documento...).
 */
export function PatientPendenciesDialog({
  patientId,
  patientName,
  pills,
  panels,
  onClose,
}: {
  patientId: string;
  patientName: string;
  pills: PatientPill[];
  panels: PatientPanel[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pendências de ${patientName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-[min(920px,96vw)] flex-col rounded-xl border border-paper-line bg-paper shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-paper-line p-5">
          <div className="min-w-0">
            <h3 className="m-0 truncate text-base font-semibold text-ink">{patientName}</h3>
            <p className="m-0 mt-0.5 text-sm text-ink-soft">
              {pills.length === 0 ? "Nenhuma pendência." : `${pills.length} ${pills.length === 1 ? "pendência" : "pendências"}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/recepcao/pacientes/${patientId}`} className="text-sm text-chart">
              Abrir prontuário
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-line-strong hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {pills.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {pills.map((pill) => (
                <li key={pill.key} className="flex items-center gap-2 text-sm text-ink">
                  <PillChip pill={pill} />
                  <span className="text-ink-soft">{pill.detail}</span>
                </li>
              ))}
            </ul>
          )}
          {panels.map((panel) => (
            <section key={panel.id} className="rounded-lg border border-paper-line-strong bg-paper-surface p-4">
              <h4 className="m-0 mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">{panel.label}</h4>
              {panel.node}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
