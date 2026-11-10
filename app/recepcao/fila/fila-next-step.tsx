"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import type { FilaItem } from "@/lib/fila/fila-model-pure";
import {
  buildDocumentsOpenerMessage,
  buildMissingDocumentMessage,
  findMissingDocumentTemplate,
} from "@/lib/document-request-templates";
import {
  enableDraftScheduling,
  markGuideSent,
  registerAuthorizedGuide,
  undoDraftAuthorization,
  undoGuideSent,
  waiveDraftAuthorization,
} from "../pacientes/pendencias/draft-pipeline-actions";
import { openDocumentConversation, requestMissingDocument } from "../pacientes/pendencias/document-request-actions";
import { AuthorizedGuideDialog, type GuideValues } from "../pacientes/pendencias/draft-pipeline";
import type { FilaDetail } from "./fila-detail-action";

/** Ações que mandam WhatsApp ou habilitam o agendamento NÃO se desfazem: pedem conferência antes. */
type Confirm = "ask" | "remind" | "opener" | "enable" | null;

const UNDO_MS = 8000;

/**
 * UM próximo passo por vez. Segurança por tipo de ação:
 *  • WhatsApp (pedir documento, lembrete, mensagem de abertura) e "Habilitar agendamento" (que dispara a
 *    oferta de horários): mostram o que vai acontecer e só enviam depois de "Enviar" (não têm Desfazer).
 *  • Guia enviada e "Particular, sem guia": reversíveis, vão direto com aviso e Desfazer por 8 s.
 *  • "Plano autorizou": abre o formulário da guia (grava a guia, habilita o agendamento e avisa a família).
 */
export function FilaNextStep({ item, detail }: { item: FilaItem; detail: FilaDetail | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);

  const { step } = item;
  const firstName = item.child.trim().split(/\s+/)[0] || "A família";
  const patientName = detail?.patientName ?? null;

  const done = (message: string, undo?: () => Promise<{ success: boolean }>) => {
    setConfirm(null);
    setError(null);
    toast(
      message,
      "success",
      undo
        ? () => {
            void undo()
              .then(() => router.refresh())
              .catch(() => toast("Não foi possível desfazer. Confira o estado da família.", "error"));
          }
        : undefined,
      undo ? UNDO_MS : undefined,
    );
    router.refresh();
  };

  const fail = (text: string) => setError(text);

  /**
   * Toda ação roda aqui. Uma server action que LANÇA (rede, erro inesperado) subiria da transição para o
   * error.tsx e derrubaria a tela inteira; aqui vira uma mensagem no próprio cartão, sem perder o contexto.
   */
  const perform = (action: () => Promise<void>) => {
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        console.error("[fila] ação falhou:", err);
        setGuideError("Não foi possível concluir. Confira o estado da família antes de repetir.");
        fail("Não foi possível concluir. Confira o histórico da família antes de repetir, para não enviar duas vezes.");
      }
    });
  };

  /** Pedido de documento ou lembrete: uma mensagem por documento, parando no primeiro erro. */
  const sendDocumentMessages = (keys: string[], successMessage: string) => {
    setError(null);
    perform(async () => {
      for (const key of keys) {
        const result = await requestMissingDocument(item.draftId, key);
        if (!result.success) {
          fail(result.error);
          return;
        }
      }
      done(successMessage);
    });
  };

  const sendOpener = () => {
    setError(null);
    perform(async () => {
      const result = await openDocumentConversation(item.draftId);
      if (!result.success) return fail(result.error);
      done("Mensagem de abertura enviada. Quando a família responder, peça os documentos.");
    });
  };

  const registerGuideSent = () => {
    setError(null);
    perform(async () => {
      const result = await markGuideSent(item.draftId);
      if (!result.success) return fail(result.error);
      done(`Guia registrada. ${firstName} foi para "Aguardando plano".`, () => undoGuideSent(item.draftId));
    });
  };

  const waiveAuthorization = () => {
    setError(null);
    perform(async () => {
      const result = await waiveDraftAuthorization(item.draftId);
      if (!result.success) return fail(result.error);
      done("Atendimento particular registrado, sem guia.", () => undoDraftAuthorization(item.draftId));
    });
  };

  const enableScheduling = () => {
    setError(null);
    perform(async () => {
      const result = await enableDraftScheduling(item.draftId);
      if (!result.success) return fail(result.error);
      setConfirm(null);
      if (result.offer === "failed") {
        toast(`Agendamento habilitado, mas os horários não saíram por WhatsApp. ${result.note ?? ""}`.trim(), "error");
      } else {
        toast(result.note || `Agendamento habilitado. ${firstName} segue com a Supervisão.`, "success");
      }
      router.refresh();
    });
  };

  // Mesma sequência do "Plano autorizou" atual (draft-pipeline.tsx): grava a guia, habilita o agendamento e
  // a oferta de horários sai por WhatsApp. Por isso não há Desfazer.
  const confirmAuthorized = (values: GuideValues) => {
    setGuideError(null);
    perform(async () => {
      const saved = await registerAuthorizedGuide(item.draftId, {
        guideNumber: values.guideNumber,
        validTo: values.validTo,
        procedures: values.procedures.map((p) => ({ code: p.code, description: p.description, quantity: Number(p.quantity) })),
      });
      if (!saved.success) return setGuideError(saved.error);
      const enabled = await enableDraftScheduling(item.draftId);
      setGuideOpen(false);
      if (!enabled.success) {
        toast(`Guia salva, mas não foi possível habilitar o agendamento: ${enabled.error}`, "error");
      } else {
        const note = [saved.note, enabled.note].filter(Boolean).join(" ");
        toast(note || `Autorização registrada. ${firstName} segue com a Supervisão.`, enabled.offer === "failed" ? "error" : "success");
      }
      router.refresh();
    });
  };

  const previewKeys = confirm === "remind" ? item.remindKeys : item.askKeys;
  const previewMessages = previewKeys.flatMap((key) => {
    const template = findMissingDocumentTemplate(key);
    return template ? [{ key, label: template.label, text: buildMissingDocumentMessage(template, patientName) }] : [];
  });

  const primaryClass = "btn btn-primary justify-center gap-2 text-[17px]";
  const spinner = isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null;

  return (
    <section
      aria-label="Próximo passo"
      className="rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-accent-100)] p-6"
    >
      <div className="text-sm font-extrabold uppercase tracking-wide text-[var(--color-accent)]">Próximo passo</div>
      <h3 className="m-0 mb-1 mt-1.5 text-[22px] font-extrabold text-ink">{step.title}</h3>
      <p className="m-0 mb-4 text-base text-ink-soft">{step.description}</p>

      {/* Conferência: o que vai por WhatsApp, antes de enviar */}
      {(confirm === "ask" || confirm === "remind") && (
        <div className="mb-4 flex flex-col gap-3">
          <p className="m-0 text-base text-ink-soft">
            Vai por WhatsApp para a família{previewMessages.length > 1 ? `, em ${previewMessages.length} mensagens (uma por documento)` : ""}.
            Mensagem enviada não pode ser desfeita, por isso a conferência.
          </p>
          {/* Os textos só trocam o nome do documento: a primeira fica aberta, as demais recolhidas, mas todas
              conferíveis antes de enviar. */}
          {previewMessages.map((m, index) => (
            <details key={m.key} open={index === 0} className="rounded-xl border border-paper-line-strong bg-white p-4">
              <summary className="cursor-pointer text-sm font-bold text-ink-soft">
                {previewMessages.length > 1 ? `Mensagem ${index + 1} de ${previewMessages.length}: ` : ""}
                {m.label}
              </summary>
              <p className="m-0 mt-2 whitespace-pre-wrap text-base text-ink">{m.text}</p>
            </details>
          ))}
        </div>
      )}
      {confirm === "opener" && (
        <div className="mb-4 flex flex-col gap-3">
          <p className="m-0 text-base text-ink-soft">
            Envia o modelo aprovado que reabre a conversa (use quando a família não escreve há mais de 24 horas). Não pode ser desfeito.
          </p>
          <div className="rounded-xl border border-paper-line-strong bg-white p-4">
            <p className="m-0 whitespace-pre-wrap text-base text-ink">{buildDocumentsOpenerMessage(patientName)}</p>
          </div>
        </div>
      )}
      {confirm === "enable" && (
        <p className="m-0 mb-4 text-base text-ink">
          Ao habilitar, a família recebe os horários da 1ª avaliação por WhatsApp. Isso não pode ser desfeito.
        </p>
      )}

      {error && (
        <p role="alert" className="m-0 mb-4 rounded-lg border border-status-negative-text/40 bg-white p-3 text-base text-status-negative-text">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {confirm === null && step.primaryLabel && step.kind !== "review_data" && (
          <button
            type="button"
            disabled={isPending}
            className={primaryClass}
            onClick={() => {
              setError(null);
              if (step.kind === "ask_documents") setConfirm("ask");
              else if (step.kind === "wait_family") setConfirm("remind");
              else if (step.kind === "send_guide") registerGuideSent();
              else if (step.kind === "wait_plan") setGuideOpen(true);
              else if (step.kind === "enable_scheduling") setConfirm("enable");
            }}
          >
            {spinner}
            {step.primaryLabel}
          </button>
        )}

        {step.kind === "review_data" && (
          <Link href={`/recepcao/pre-cadastros/${item.draftId}`} className={`${primaryClass} no-underline`}>
            <ClipboardList size={16} aria-hidden />
            {step.primaryLabel}
          </Link>
        )}

        {confirm !== null && (
          <>
            <button
              type="button"
              disabled={isPending}
              className={primaryClass}
              onClick={() => {
                if (confirm === "ask") sendDocumentMessages(item.askKeys, `Pedido enviado. ${firstName} foi para "Aguardando família".`);
                else if (confirm === "remind") sendDocumentMessages(item.remindKeys, "Lembrete enviado à família.");
                else if (confirm === "opener") sendOpener();
                else enableScheduling();
              }}
            >
              {spinner}
              {confirm === "enable" ? "Habilitar e enviar horários" : "Enviar mensagem"}
            </button>
            <button
              type="button"
              disabled={isPending}
              className="btn btn-secondary justify-center"
              onClick={() => {
                setConfirm(null);
                setError(null);
              }}
            >
              Cancelar
            </button>
          </>
        )}

        {confirm === null && step.kind === "send_guide" && (
          <button type="button" disabled={isPending} className="btn btn-secondary justify-center" onClick={waiveAuthorization}>
            Particular, sem guia
          </button>
        )}
        {confirm === null && step.kind === "wait_plan" && (
          <button
            type="button"
            disabled={isPending}
            className="btn btn-ghost justify-center"
            onClick={() => {
              setError(null);
              perform(async () => {
                const result = await undoGuideSent(item.draftId);
                if (!result.success) return fail(result.error);
                toast("Registro de guia enviada desfeito.", "info");
                router.refresh();
              });
            }}
          >
            A guia não foi enviada
          </button>
        )}
      </div>

      {/* Sem resposta há mais de 24 h o pedido livre é recusado pela Meta: a saída é o modelo de abertura. */}
      {confirm === null && (step.kind === "ask_documents" || step.kind === "wait_family") && (
        <p className="m-0 mt-4 text-sm text-ink-soft">
          A família não responde há mais de 24 horas?{" "}
          <button type="button" className="font-semibold text-[var(--color-accent)] underline" onClick={() => setConfirm("opener")}>
            Enviar a mensagem de abertura
          </button>
        </p>
      )}

      {guideOpen && (
        <AuthorizedGuideDialog
          suggestedGuide={detail?.pipeline.suggestedGuide ?? null}
          pending={isPending}
          error={guideError}
          onClose={() => setGuideOpen(false)}
          onConfirm={confirmAuthorized}
        />
      )}
    </section>
  );
}
