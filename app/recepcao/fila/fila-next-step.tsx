"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, MessageCircle } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import type { FilaItem } from "@/lib/fila/fila-model-pure";
import { actionConfirms, actionOffersUndo, guideConfirmSummary, type FilaActionKey } from "@/lib/fila/fila-action-policy-pure";
import { chatHref } from "@/lib/atendimento/chat-deep-link-pure";
import {
  buildDocumentsOpenerMessage,
  buildMissingDocumentMessage,
  findMissingDocumentTemplate,
} from "@/lib/document-request-templates";
import { enableDraftScheduling, registerAuthorizedGuide } from "../pacientes/pendencias/draft-pipeline-actions";
import {
  intakeDenyPlan,
  intakeMarkGuideSent,
  intakePlanAskedMoreDocs,
  intakeUnmarkGuideSent,
  intakeWaiveAuthorization,
  restoreIntakeState,
  type UndoableResult,
} from "../pacientes/pendencias/intake-actions";
import { openDocumentConversation, requestMissingDocument } from "../pacientes/pendencias/document-request-actions";
import { AuthorizedGuideDialog, type GuideValues } from "../pacientes/pendencias/draft-pipeline";
import type { FilaDetail } from "@/lib/fila/fila-detail-pure";
import type { UndoEntry } from "./undo-toast";

/** Conferências abertas no cartão. Cada uma corresponde a uma ação que manda WhatsApp (sem Desfazer). */
type Confirm = "ask" | "remind" | "more_docs" | "opener" | "enable" | "authorize";

const CONFIRM_ACTION: Record<Confirm, FilaActionKey> = {
  ask: "ask_documents",
  remind: "remind",
  more_docs: "more_docs_request",
  opener: "opener",
  enable: "enable_scheduling",
  authorize: "authorize_and_enable",
};

const CONFIRM_GROUP_LABEL: Record<Confirm, string> = {
  ask: "Conferir o pedido de documentos antes de enviar",
  remind: "Conferir o lembrete antes de enviar",
  more_docs: "Conferir o pedido de documentos antes de enviar",
  opener: "Conferir a mensagem de abertura antes de enviar",
  enable: "Confirmar a habilitação do agendamento",
  authorize: "Confirmar a guia autorizada e o envio dos horários",
};

/**
 * UM próximo passo por vez. A segurança de cada ação vem de lib/fila/fila-action-policy-pure.ts:
 *  - WhatsApp (pedir documentos, lembrete, mensagem de abertura, habilitar o agendamento e "Plano autorizou",
 *    que habilita e dispara a oferta de horários): mostram o que vai acontecer e só enviam depois da
 *    confirmação. Não têm Desfazer.
 *  - Guia enviada, guia não enviada, particular sem guia, plano negou e plano pediu mais documentos: vão
 *    direto e mostram Desfazer por 8 s (restaura o estado de antes, só se o caso não mudou depois).
 */
export function FilaNextStep({
  item,
  detail,
  locked,
  onUndoable,
}: {
  item: FilaItem;
  detail: FilaDetail | null;
  /** Detalhe carregando, rebuscando ou com erro: as ações ficam visíveis mas desabilitadas (isDetailLocked). */
  locked: boolean;
  onUndoable: (entry: UndoEntry) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [pendingGuide, setPendingGuide] = useState<GuideValues | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Ao abrir uma conferência, o foco vai para o botão que confirma (teclado e leitor de tela chegam nela).
  useEffect(() => {
    if (confirm) confirmButtonRef.current?.focus();
  }, [confirm]);

  const { step } = item;
  const firstName = item.child.trim().split(/\s+/)[0] || "A família";
  const patientName = detail?.patientName ?? null;
  const chatLink = item.phone ? chatHref({ phone: item.phone }) : null;

  const fail = (text: string) => setError(text);

  /** Abre a conferência quando a política pede; senão roda direto. */
  const request = (which: Confirm, run: () => void) => {
    setError(null);
    if (actionConfirms(CONFIRM_ACTION[which])) setConfirm(which);
    else run();
  };

  const finishSent = (message: string) => {
    setConfirm(null);
    setError(null);
    toast(message, "success");
    router.refresh();
  };

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

  /**
   * Ação reversível: vai direto e, se a política dá Desfazer e o servidor devolveu o estado de antes, mostra
   * o aviso de 8 s. Sem o estado de antes (migration pendente), avisa que ficou sem Desfazer.
   */
  const runUndoable = (key: FilaActionKey, action: () => Promise<UndoableResult>, message: string) => {
    setError(null);
    perform(async () => {
      const result = await action();
      if (!result.success) return fail(result.error);
      setConfirm(null);
      const token = result.undo;
      if (actionOffersUndo(key) && token) {
        onUndoable({ draftId: item.draftId, message, undo: () => restoreIntakeState(item.draftId, token) });
      } else {
        toast(`${message} (sem Desfazer)`, "success");
      }
      router.refresh();
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
      finishSent(successMessage);
    });
  };

  const sendOpener = () => {
    setError(null);
    perform(async () => {
      const result = await openDocumentConversation(item.draftId);
      if (!result.success) return fail(result.error);
      finishSent("Mensagem de abertura enviada. Quando a família responder, peça os documentos.");
    });
  };

  const registerGuideSent = () =>
    runUndoable("guide_sent", () => intakeMarkGuideSent(item.draftId), `Guia registrada. ${firstName} foi para "Aguardando plano".`);

  const waiveAuthorization = () =>
    runUndoable("waive", () => intakeWaiveAuthorization(item.draftId), "Atendimento particular registrado, sem guia.");

  const unmarkGuideSent = () =>
    runUndoable("guide_not_sent", () => intakeUnmarkGuideSent(item.draftId), "Registro de guia enviada desfeito.");

  const denyPlan = () =>
    runUndoable("plan_denied", () => intakeDenyPlan(item.draftId), `Negativa registrada. ${firstName} voltou para "Agir agora".`);

  const planAskedMoreDocs = () =>
    runUndoable(
      "plan_more_docs",
      () => intakePlanAskedMoreDocs(item.draftId),
      `Pedido do plano registrado. ${firstName} voltou para os documentos.`,
    );

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

  // O formulário da guia só guarda os valores; nada é gravado antes da confirmação abaixo.
  const reviewAuthorized = (values: GuideValues) => {
    setGuideError(null);
    setPendingGuide(values);
    setGuideOpen(false);
    request("authorize", () => saveAuthorized(values));
  };

  // Mesma sequência do "Plano autorizou" de draft-pipeline.tsx: grava a guia, habilita o agendamento e a
  // oferta de horários sai por WhatsApp. Por isso não há Desfazer.
  const saveAuthorized = (values: GuideValues) => {
    setError(null);
    perform(async () => {
      const saved = await registerAuthorizedGuide(item.draftId, {
        guideNumber: values.guideNumber,
        validTo: values.validTo,
        procedures: values.procedures.map((p) => ({ code: p.code, description: p.description, quantity: Number(p.quantity) })),
      });
      if (!saved.success) {
        // Erro de validação da guia: reabre o formulário com os valores digitados para corrigir.
        setGuideError(saved.error);
        setConfirm(null);
        setGuideOpen(true);
        return;
      }
      const enabled = await enableDraftScheduling(item.draftId);
      setConfirm(null);
      setPendingGuide(null);
      if (!enabled.success) {
        toast(`Guia salva, mas não foi possível habilitar o agendamento: ${enabled.error}`, "error");
      } else {
        const note = [saved.note, enabled.note].filter(Boolean).join(" ");
        toast(note || `Autorização registrada. ${firstName} segue com a Supervisão.`, enabled.offer === "failed" ? "error" : "success");
      }
      router.refresh();
    });
  };

  const previewKeys = confirm === "remind" ? item.remindKeys : confirm === "more_docs" ? item.moreDocsKeys : item.askKeys;
  const previewMessages = previewKeys.flatMap((key) => {
    const template = findMissingDocumentTemplate(key);
    return template ? [{ key, label: template.label, text: buildMissingDocumentMessage(template, patientName) }] : [];
  });

  // Sem documento para pedir, o passo leva ao Chat em vez de um envio com zero mensagens.
  const chatInsteadOfSend =
    (step.kind === "plan_more_docs" && item.moreDocsKeys.length === 0) || (step.kind === "wait_family" && item.remindKeys.length === 0);

  const primaryClass = "btn btn-primary min-h-11 justify-center gap-2 text-[17px]";
  const secondaryClass = "btn btn-secondary min-h-11 justify-center text-base";
  const ghostClass = "btn btn-ghost min-h-11 justify-center text-base";
  const spinner = isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null;

  const askSuccess = `Pedido enviado. ${firstName} foi para "Aguardando família".`;
  const remindSuccess = "Lembrete enviado à família.";
  const moreDocsSuccess = `Pedido enviado. ${firstName} foi para "Aguardando família".`;

  const onPrimary = () => {
    setError(null);
    if (step.kind === "ask_documents") request("ask", () => sendDocumentMessages(item.askKeys, askSuccess));
    else if (step.kind === "wait_family") request("remind", () => sendDocumentMessages(item.remindKeys, remindSuccess));
    else if (step.kind === "plan_more_docs") request("more_docs", () => sendDocumentMessages(item.moreDocsKeys, moreDocsSuccess));
    else if (step.kind === "send_guide") registerGuideSent();
    else if (step.kind === "wait_plan") setGuideOpen(true);
    else if (step.kind === "enable_scheduling") request("enable", enableScheduling);
  };

  const onConfirm = () => {
    if (confirm === "ask") sendDocumentMessages(item.askKeys, askSuccess);
    else if (confirm === "remind") sendDocumentMessages(item.remindKeys, remindSuccess);
    else if (confirm === "more_docs") sendDocumentMessages(item.moreDocsKeys, moreDocsSuccess);
    else if (confirm === "opener") sendOpener();
    else if (confirm === "enable") enableScheduling();
    else if (confirm === "authorize" && pendingGuide) saveAuthorized(pendingGuide);
  };

  const confirmLabel =
    confirm === "enable" ? "Habilitar e enviar horários" : confirm === "authorize" ? "Salvar e enviar horários" : "Enviar mensagem";

  return (
    <section
      aria-label="Próximo passo"
      className="rounded-2xl border-2 border-[var(--color-accent)] bg-[var(--color-accent-100)] p-6"
    >
      <div className="text-sm font-extrabold text-[var(--color-accent)]">Próximo passo</div>
      <h3 className="m-0 mb-1 mt-1.5 text-[22px] font-extrabold text-ink">{step.title}</h3>
      <p className="m-0 mb-4 text-base text-ink-soft">{step.description}</p>

      {step.kind === "send_guide" && item.planOutcome === "denied" && (
        <p role="status" className="m-0 mb-4 text-base font-bold text-status-negative-text">
          O plano negou a guia.
        </p>
      )}

      <div role={confirm ? "group" : undefined} aria-label={confirm ? CONFIRM_GROUP_LABEL[confirm] : undefined}>
        {/* Conferência: o que vai por WhatsApp, antes de enviar */}
        {(confirm === "ask" || confirm === "remind" || confirm === "more_docs") && (
          <div className="mb-4 flex flex-col gap-3">
            <p className="m-0 text-base text-ink-soft">
              Vai por WhatsApp para a família{previewMessages.length > 1 ? `, em ${previewMessages.length} mensagens (uma por documento)` : ""}.
              Mensagem enviada não pode ser desfeita, por isso a conferência.
            </p>
            {/* Os textos só trocam o nome do documento: a primeira fica aberta, as demais recolhidas, mas todas
                conferíveis antes de enviar. */}
            {previewMessages.map((m, index) => (
              <details key={m.key} open={index === 0} className="rounded-xl border border-paper-line-strong bg-white p-4">
                <summary className="flex min-h-10 cursor-pointer items-center text-sm font-bold text-ink-soft">
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
        {confirm === "authorize" && pendingGuide && (
          <div className="mb-4 flex flex-col gap-2">
            <p className="m-0 text-base text-ink">
              Ao salvar, a guia fica registrada e a família recebe os horários da 1ª avaliação por WhatsApp. Isso não pode ser desfeito.
            </p>
            <p className="m-0 text-base text-ink-soft">{guideConfirmSummary(pendingGuide)}</p>
          </div>
        )}

        {error && (
          <p role="alert" className="m-0 mb-4 rounded-lg border border-status-negative-text/40 bg-white p-3 text-base text-status-negative-text">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {confirm === null && step.primaryLabel && step.kind !== "review_data" && !chatInsteadOfSend && (
            <button type="button" disabled={isPending || locked} className={primaryClass} onClick={onPrimary}>
              {spinner}
              {step.primaryLabel}
            </button>
          )}

          {confirm === null && step.primaryLabel && chatInsteadOfSend && chatLink && (
            <Link href={chatLink} className={`${primaryClass} no-underline`}>
              <MessageCircle size={16} aria-hidden />
              {step.primaryLabel}
            </Link>
          )}
          {confirm === null && chatInsteadOfSend && !chatLink && (
            <p className="m-0 text-base text-ink-soft">Sem telefone cadastrado: fale com a família pelo cadastro.</p>
          )}

          {step.kind === "review_data" && (
            <Link href={`/recepcao/pre-cadastros/${item.draftId}`} className={`${primaryClass} no-underline`}>
              <ClipboardList size={16} aria-hidden />
              {step.primaryLabel}
            </Link>
          )}

          {confirm !== null && (
            <>
              <button ref={confirmButtonRef} type="button" disabled={isPending || locked} className={primaryClass} onClick={onConfirm}>
                {spinner}
                {confirmLabel}
              </button>
              {/* Cancelar não grava nada: continua livre mesmo com o detalhe travado. */}
              <button
                type="button"
                disabled={isPending}
                className={secondaryClass}
                onClick={() => {
                  setConfirm(null);
                  setPendingGuide(null);
                  setError(null);
                }}
              >
                Cancelar
              </button>
              {confirm === "authorize" && (
                <button
                  type="button"
                  disabled={isPending || locked}
                  className={ghostClass}
                  onClick={() => {
                    setConfirm(null);
                    setError(null);
                    setGuideError(null);
                    setGuideOpen(true);
                  }}
                >
                  Voltar e corrigir
                </button>
              )}
            </>
          )}

          {confirm === null && step.kind === "send_guide" && (
            <button type="button" disabled={isPending || locked} className={secondaryClass} onClick={waiveAuthorization}>
              Particular, sem guia
            </button>
          )}
          {confirm === null && step.kind === "plan_more_docs" && (
            <button type="button" disabled={isPending || locked} className={secondaryClass} onClick={registerGuideSent}>
              Guia reenviada ao plano
            </button>
          )}
          {confirm === null && step.kind === "wait_plan" && (
            <>
              <button type="button" disabled={isPending || locked} className={secondaryClass} onClick={denyPlan}>
                Plano negou
              </button>
              <button type="button" disabled={isPending || locked} className={secondaryClass} onClick={planAskedMoreDocs}>
                Plano pediu mais documentos
              </button>
              <button type="button" disabled={isPending || locked} className={ghostClass} onClick={unmarkGuideSent}>
                A guia não foi enviada
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sem resposta há mais de 24 h o pedido livre é recusado pela Meta: a saída é o modelo de abertura. */}
      {confirm === null && (step.kind === "ask_documents" || step.kind === "wait_family" || step.kind === "plan_more_docs") && (
        <p className="m-0 mt-4 text-base text-ink-soft">
          A família não responde há mais de 24 horas?{" "}
          <button
            type="button"
            disabled={isPending || locked}
            className="inline-flex min-h-10 items-center font-semibold text-[var(--color-accent)] underline"
            onClick={() => request("opener", sendOpener)}
          >
            Enviar a mensagem de abertura
          </button>
        </p>
      )}

      {guideOpen && (
        <AuthorizedGuideDialog
          suggestedGuide={detail?.pipeline.suggestedGuide ?? null}
          pending={isPending}
          error={guideError}
          initialValues={pendingGuide ?? undefined}
          onClose={() => {
            setGuideOpen(false);
            setGuideError(null);
            setPendingGuide(null);
          }}
          onConfirm={reviewAuthorized}
        />
      )}
    </section>
  );
}
