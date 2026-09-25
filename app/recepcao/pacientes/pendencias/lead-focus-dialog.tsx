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
  onClose,
}: {
  draft?: PendingRegistrationDraft | null;
  children?: ReactNode;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [reading, startReading] = useTransition();
  const firedRef = useRef(false);

  const close = () => {
    if (onClose) {
      onClose();
      return;
    }
    router.replace("/recepcao/pacientes/pendencias", { scroll: false });
    if (draft?.id) {
      requestAnimationFrame(() => {
        document.getElementById(`lead-${draft.id}`)?.scrollIntoView({ block: "center" });
      });
    }
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
    if (!draft) return;
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
  }, [draft?.id, draft?.status, draft?.files.length]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={draft ? `Pendência de ${draft.patientName ?? formatPhoneDisplay(draft.sourcePhone)}` : "Carregando pendência"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex h-[94vh] w-[min(1400px,96vw)] flex-col rounded-xl border border-paper-line bg-paper shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-paper-line p-5">
          {draft ? (
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-ink">
                {draft.patientName ?? formatPhoneDisplay(draft.sourcePhone)}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <SummaryChip pendencies={draft.pendencies} />
                <DraftPipelineMini pipeline={draft.pipeline} />
                <span className="whitespace-nowrap rounded-full bg-paper-subtle px-2 py-0.5 text-[13px] font-medium text-ink-soft">
                  {draft.source === "whatsapp" ? "WhatsApp" : "Portal da família"}
                </span>
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1 animate-pulse">
              <div className="h-5 w-48 rounded bg-paper-line/60"></div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-4 w-24 rounded-full bg-paper-line/40"></div>
                <div className="h-4 w-36 rounded-full bg-paper-line/40"></div>
              </div>
            </div>
          )}
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
          {reading && <p className="m-0 mb-3 text-sm text-ink-faint">Lendo os documentos com IA…</p>}
          {draft ? (
            children
          ) : (
            <div className="flex flex-col gap-4 animate-pulse">
              <div className="h-12 w-full rounded-md bg-paper-line/30"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="h-64 rounded-lg bg-paper-line/20"></div>
                <div className="h-64 rounded-lg bg-paper-line/20"></div>
                <div className="h-64 rounded-lg bg-paper-line/20"></div>
                <div className="h-64 rounded-lg bg-paper-line/20"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
