"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { formatPhoneDisplay } from "@/lib/whatsapp-leads-view";
import type { PendingRegistrationDraft } from "@/lib/reception-queue";
import { SummaryChip } from "./pendency-pills";
import { DraftPipelineMini } from "./draft-pipeline";
import { extractDraftOnDemand } from "./draft-pipeline-actions";

/**
 * Painel flutuante quase em tela cheia de UM contato da fila de pendências —
 * aberto pelo botão "Resolver pendências" do Atendimento
 * (app/recepcao/atendimento/lead-context-panel.tsx, via `?lead=<draftId>`).
 * A lista de faixas da fila continua atrás, sem mudanças; aqui é só o mesmo
 * cartão (`DraftIntakeCard`, passado como children) com foco total — sem
 * precisar abrir o módulo de Atendimento para resolver a pendência.
 */
export function LeadFocusDialog({
  draft,
  children,
}: {
  draft: PendingRegistrationDraft;
  children: ReactNode;
}) {
  const router = useRouter();
  const [reading, startReading] = useTransition();
  const firedRef = useRef(false);

  const close = () => {
    router.replace("/recepcao/pacientes/pendencias", { scroll: false });
    // A faixa correspondente continua na lista atrás do painel — rola até
    // ela para o operador não perder o contato de vista ao fechar.
    requestAnimationFrame(() => {
      document.getElementById(`lead-${draft.id}`)?.scrollIntoView({ block: "center" });
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mesma regra da linha da fila (CollapsibleQueueRow, onFirstOpen): lê os
  // arquivos com IA só ao abrir o contato, uma vez, e nunca ao carregar a fila.
  useEffect(() => {
    if (firedRef.current) return;
    if ((draft.status !== "pending" && draft.status !== "failed") || draft.files.length === 0) return;
    firedRef.current = true;
    startReading(async () => {
      try {
        await extractDraftOnDemand(draft.id);
        router.refresh();
      } catch {
        // A leitura é só um acelerador: falha aqui não impede o trabalho manual.
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id, draft.status, draft.files.length]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pendência de ${draft.patientName ?? formatPhoneDisplay(draft.sourcePhone)}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex h-[94vh] w-[min(1400px,96vw)] flex-col rounded-xl border border-paper-line bg-paper shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-paper-line p-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ink">
              {draft.patientName ?? formatPhoneDisplay(draft.sourcePhone)}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <SummaryChip pendencies={draft.pendencies} />
              <DraftPipelineMini pipeline={draft.pipeline} />
              <span className="whitespace-nowrap rounded-full bg-paper-subtle px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                {draft.source === "whatsapp" ? "WhatsApp" : "Portal da família"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-paper-line-strong hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {reading && <p className="m-0 mb-3 text-[12px] text-ink-faint">Lendo os documentos com IA…</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
