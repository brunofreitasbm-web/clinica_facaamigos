"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import type { PendingRegistrationDraft, DraftAuthorizedGuide } from "@/lib/reception-queue";
import { visiblePills } from "@/lib/lead-pendencies";
import { buildPlanAuthorizedMessage, buildWhatsappLink } from "@/lib/whatsapp-message";
import {
  disableDraftScheduling,
  enableDraftScheduling,
  markGuideSent,
  parseAuthorizedGuidePdf,
  registerAuthorizedGuide,
  undoDraftAuthorization,
  undoGuideSent,
  waiveDraftAuthorization,
} from "./draft-pipeline-actions";

/**
 * Linha do tempo de um contato da fila de pendências, do recebimento dos
 * arquivos até o agendamento:
 *
 *   ① Documentos recebidos → ② Guia enviada ao plano → ③ Plano autorizou → ④ Habilitado para agendamento
 *
 * ② e ③ são processo manual da clínica com o convênio: a recepção/supervisão
 * marca quando enviou a guia (② — fora do sistema, portal/e-mail/telefone) e
 * depois registra o resultado e a guia autorizada quando o plano responde
 * (③). ④ é o "ok" que a Agenda 1ª Avaliação da Supervisão exige antes de
 * deixar marcar (lib/evaluation-agenda.ts).
 */

type StepState = "done" | "current" | "locked";

function stepStates(pipeline: PendingRegistrationDraft["pipeline"]): [StepState, StepState, StepState, StepState] {
  const waived = pipeline.authorization === "dispensada";
  const sentDone = waived || pipeline.authorization !== "pendente";
  const authDone = waived || pipeline.authorization === "autorizada";
  const enabled = Boolean(pipeline.schedulingEnabledAt);
  return [
    "done",
    sentDone ? "done" : "current",
    authDone ? "done" : sentDone ? "current" : "locked",
    enabled ? "done" : authDone ? "current" : "locked",
  ];
}

const STEP_TITLE = [
  "Documentos recebidos",
  "Guia enviada ao plano",
  "Plano autorizou",
  "Habilitado p/ agendamento",
] as const;

const STATE_STYLE: Record<StepState, string> = {
  // Etapa vencida em "penumbra" (volta ao normal no hover/foco, para o Desfazer continuar à mão);
  // a da vez fica em destaque; a futura fica discreta.
  done: "border-status-positive-text/30 bg-status-positive-text/5 opacity-50 saturate-50 transition-opacity hover:opacity-100 focus-within:opacity-100",
  current: "border-2 border-[var(--color-accent)] bg-paper-surface shadow-lg ring-4 ring-[var(--color-accent)]/20",
  locked: "border-dashed border-paper-line-strong bg-paper/40 opacity-70",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Resumo da linha retrátil da fila: UM chip com a etapa em que o contato está
 * (a trilha inteira vai no title/aria-label). O passo 1 é sempre "done" e quase
 * todos os contatos estão na mesma etapa, então três pílulas repetidas em cada
 * linha eram só ruído — a linha do tempo completa, com as ações, fica no cartão.
 */
export function DraftPipelineMini({ pipeline }: { pipeline: PendingRegistrationDraft["pipeline"] }) {
  const states = stepStates(pipeline);
  const currentIndex = states.findIndex((state) => state === "current");
  const allDone = currentIndex === -1;

  const trail = STEP_TITLE.map((title, index) => {
    const state = states[index];
    return `${title}${state === "done" ? " ✓" : state === "current" ? " (atual)" : " (bloqueado)"}`;
  }).join(" · ");

  return (
    <span
      title={trail}
      aria-label={trail}
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[13px] font-medium ${
        allDone ? "border-status-positive-text/60 text-status-positive-text" : "border-[var(--color-accent)] text-ink"
      }`}
    >
      {allDone ? `✓ ${STEP_TITLE[3]}` : `Etapa ${currentIndex + 1}/4 · ${STEP_TITLE[currentIndex]}`}
    </span>
  );
}

function StepShell({
  index,
  state,
  status,
  children,
}: {
  index: number;
  state: StepState;
  status: string;
  children: ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col gap-2 rounded-md border px-3 py-3 ${STATE_STYLE[state]}`}>
      <header className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
            state === "done" ? "bg-status-positive-text text-white" : "border border-paper-line-strong text-ink-soft"
          }`}
        >
          {state === "done" ? "✓" : index + 1}
        </span>
        <div className="min-w-0">
          <h3
            className={`m-0 text-[13px] font-semibold uppercase tracking-wide ${state === "current" ? "text-[var(--color-accent)]" : "text-ink-soft"}`}
          >
            {STEP_TITLE[index - 1]}
          </h3>
          {state === "current" && (
            <span className="mt-0.5 inline-block rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Na vez
            </span>
          )}
          <p
            className={`m-0 text-sm ${
              state === "done" ? "text-status-positive-text" : state === "current" ? "text-ink" : "text-ink-faint"
            }`}
          >
            {status}
          </p>
        </div>
      </header>
      {children}
    </section>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="flex items-center justify-center text-lg text-ink-faint md:px-0.5">
      <span className="md:hidden">↓</span>
      <span className="hidden md:inline">→</span>
    </span>
  );
}

function StepButton({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50 ${
        primary
          ? "border-0 text-white"
          : "border border-paper-line-strong bg-paper text-ink hover:bg-paper-subtle"
      }`}
      style={primary ? { backgroundColor: "var(--color-accent)" } : undefined}
    >
      {children}
    </button>
  );
}

type GuideValues = { guideNumber: string; validTo: string; procedures: { code: string; description: string; quantity: string }[] };

const EMPTY_PROCEDURE = { code: "", description: "", quantity: "" };

function defaultGuideValues(suggested?: DraftAuthorizedGuide | null): GuideValues {
  const defaultValidTo = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  const procedures = suggested?.procedures?.length
    ? suggested.procedures.map((p) => ({ code: p.code, description: p.description, quantity: String(p.quantity) }))
    : [
        {
          code: suggested?.procedure_code || "AVAL",
          description: "1ª Avaliação Global",
          quantity: String(suggested?.sessions_authorized || "1"),
        },
      ];
  return {
    guideNumber: suggested?.guide_number || "",
    validTo: suggested?.valid_to || defaultValidTo,
    procedures,
  };
}

/**
 * Menu flutuante do "Plano autorizou": a recepção sobe o PDF da guia autorizada
 * e o sistema lê, por algoritmo (sem IA), o nº da guia, a validade da senha e a
 * tabela de procedimentos (código, descrição, quantidade). Tudo continua
 * editável — a leitura é só preenchimento.
 */
function AuthorizedGuideDialog({
  suggestedGuide,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  suggestedGuide?: DraftAuthorizedGuide | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (values: GuideValues) => void;
}) {
  const [values, setValues] = useState<GuideValues>(() => defaultGuideValues(suggestedGuide));
  const [reading, startReading] = useTransition();
  const [readNote, setReadNote] = useState<{ tone: "error" | "note"; text: string } | null>(null);

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    setReadNote(null);
    const formData = new FormData();
    formData.set("file", file);
    startReading(async () => {
      const result = await parseAuthorizedGuidePdf(formData);
      if (!result.success) {
        setReadNote({ tone: "error", text: result.error });
        return;
      }
      const { guide } = result;
      setValues({
        guideNumber: guide.guideNumber ?? "",
        validTo: guide.validUntil ?? "",
        procedures: guide.procedures.map((p) => ({ code: p.code, description: p.description, quantity: String(p.quantity) })),
      });
      setReadNote({
        tone: guide.warnings.length > 0 ? "error" : "note",
        text:
          guide.warnings.length > 0
            ? guide.warnings.join(" ")
            : `Guia lida do PDF: ${guide.procedures.length} procedimento(s). Confira os campos antes de salvar.`,
      });
    });
  };

  const setProcedure = (index: number, patch: Partial<GuideValues["procedures"][number]>) =>
    setValues((v) => ({ ...v, procedures: v.procedures.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));

  const canSubmit = !pending && !reading;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plano autorizou — guia autorizada"
        className="flex max-h-[90vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-lg border border-paper-line-strong bg-paper p-5 shadow-xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold text-ink">Plano autorizou</h2>
            <p className="m-0 text-sm text-ink-faint">Suba o PDF da guia autorizada. Os campos abaixo são preenchidos sozinhos.</p>
          </div>
          <button type="button" onClick={onClose} className="border-0 bg-transparent text-lg text-ink-soft" aria-label="Fechar">
            ×
          </button>
        </header>

        <label className="flex flex-col gap-1 text-[13px] font-medium uppercase tracking-wide text-ink-soft">
          Guia autorizada (PDF)
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={reading || pending}
            onChange={(e) => onPickFile(e.target.files?.[0])}
            className="input normal-case tracking-normal"
          />
        </label>
        {reading && <p className="m-0 text-sm text-ink-soft">Lendo a guia…</p>}
        {readNote && (
          <p className={`m-0 text-sm ${readNote.tone === "error" ? "text-status-negative-text" : "text-ink-soft"}`}>{readNote.text}</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-0.5 text-[13px] font-medium uppercase tracking-wide text-ink-soft">
            Nº da guia
            <input
              value={values.guideNumber}
              onChange={(e) => setValues((v) => ({ ...v, guideNumber: e.target.value }))}
              className="input normal-case tracking-normal"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[13px] font-medium uppercase tracking-wide text-ink-soft">
            Válida até
            <input
              type="date"
              value={values.validTo}
              onChange={(e) => setValues((v) => ({ ...v, validTo: e.target.value }))}
              className="input normal-case tracking-normal"
            />
          </label>
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-[13px] font-medium uppercase tracking-wide text-ink-soft">
            Procedimentos autorizados ({values.procedures.length})
          </legend>
          {values.procedures.map((p, index) => (
            <div key={index} className="grid grid-cols-[7rem_1fr_4.5rem_auto] items-end gap-2">
              <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                Código
                <input value={p.code} onChange={(e) => setProcedure(index, { code: e.target.value })} className="input" />
              </label>
              <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                Descrição
                <input value={p.description} onChange={(e) => setProcedure(index, { description: e.target.value })} className="input" />
              </label>
              <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                Qtde.
                <input
                  type="number"
                  min={1}
                  value={p.quantity}
                  onChange={(e) => setProcedure(index, { quantity: e.target.value })}
                  className="input"
                />
              </label>
              <button
                type="button"
                onClick={() => setValues((v) => ({ ...v, procedures: v.procedures.filter((_, i) => i !== index) }))}
                className="mb-1 border-0 bg-transparent text-lg text-ink-soft"
                aria-label="Remover procedimento"
              >
                ×
              </button>
            </div>
          ))}
          <div>
            <StepButton onClick={() => setValues((v) => ({ ...v, procedures: [...v.procedures, { ...EMPTY_PROCEDURE }] }))}>
              + Procedimento
            </StepButton>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="m-0 text-sm text-status-negative-text">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <StepButton onClick={onClose} disabled={pending}>
            Cancelar
          </StepButton>
          <StepButton primary onClick={() => onConfirm(values)} disabled={!canSubmit}>
            {pending ? "Salvando…" : "Autorizado — salvar e avisar o responsável"}
          </StepButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function DraftPipelineColumns({
  draft,
  documents,
}: {
  draft: PendingRegistrationDraft;
  /** Conteúdo da coluna ① (arquivos e dados já recebidos) — montado no servidor. */
  documents: ReactNode;
}) {
  const router = useRouter();
  const { pipeline } = draft;
  const [docState, sentState, authState, schedState] = stepStates(pipeline);
  const [showGuideDialog, setShowGuideDialog] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "note"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const missingLabels = visiblePills(draft.pendencies)
    .filter((p) => p.state === "faltando")
    .map((p) => p.label);

  const handleMarkGuideSent = () => {
    if (missingLabels.length > 0 && !window.confirm(`Ainda falta: ${missingLabels.join(", ")}. Marcar como enviada mesmo assim?`)) {
      return;
    }
    run(() => markGuideSent(draft.id));
  };

  const run = (action: () => Promise<{ success: true; note?: string } | { success: false; error: string }>, after?: () => void) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setFeedback({ tone: "error", text: result.error });
        return;
      }
      router.refresh();
      if (result.note) setFeedback({ tone: "note", text: result.note });
      after?.();
    });
  };

  const guide = pipeline.authorizedGuide;
  const [dialogError, setDialogError] = useState<string | null>(null);

  const fact = (label: string) => draft.facts.find((f) => f.label === label)?.value ?? null;
  const whatsappPhone = fact("Telefone") ?? draft.sourcePhone;
  const buildAuthorizedUrl = (procedures: { description: string; quantity: number }[], validUntil: string | null) =>
    whatsappPhone
      ? buildWhatsappLink(
          whatsappPhone,
          buildPlanAuthorizedMessage({
            guardianName: fact("Responsável"),
            patientName: draft.patientName ?? fact("Criança"),
            procedures,
            validUntil,
          }),
        )
      : null;
  // Reenvio do aviso depois de autorizada: usa a guia que já ficou gravada no contato.
  const resendUrl = guide && guide.procedures.length > 0 ? buildAuthorizedUrl(guide.procedures, guide.valid_to) : null;

  // "Plano autorizou" faz três coisas: grava a guia (etapa 3), habilita o
  // agendamento (etapa 4) e abre o WhatsApp da recepção com o aviso ao responsável.
  const confirmAuthorized = (values: GuideValues) => {
    const procedures = values.procedures.map((p) => ({
      code: p.code,
      description: p.description,
      quantity: Number(p.quantity),
    }));
    const whatsappUrl = buildAuthorizedUrl(procedures, values.validTo || null);
    // A aba abre já no clique: depois de um await o navegador trata como popup e bloqueia.
    const popup = whatsappUrl ? window.open("about:blank", "_blank") : null;
    setDialogError(null);
    setFeedback(null);
    startTransition(async () => {
      const saved = await registerAuthorizedGuide(draft.id, {
        guideNumber: values.guideNumber,
        validTo: values.validTo,
        procedures,
      });
      if (!saved.success) {
        popup?.close();
        setDialogError(saved.error);
        return;
      }
      const enabled = await enableDraftScheduling(draft.id);
      if (popup && whatsappUrl) popup.location.href = whatsappUrl;
      setShowGuideDialog(false);
      window.dispatchEvent(new CustomEvent("queue-item-dismiss", { detail: { id: draft.id } }));
      router.refresh();
      if (!enabled.success) {
        setFeedback({ tone: "error", text: `Guia salva, mas não foi possível habilitar o agendamento: ${enabled.error}` });
      } else {
        const notes = [saved.note, enabled.note, whatsappUrl ? null : "Sem telefone do responsável — avise a família por outro canal."];
        const note = notes.filter(Boolean).join(" ");
        if (note) setFeedback({ tone: "note", text: note });
      }
    });
  };

  const sentStatus =
    pipeline.authorization === "dispensada"
      ? "Dispensada — particular / sem guia"
      : pipeline.guideSentAt
        ? `Enviada em ${fmtDateTime(pipeline.guideSentAt, CLINIC_TIMEZONE)}${pipeline.guideSentByName ? ` por ${pipeline.guideSentByName}` : ""}`
        : "Aguardando o envio";

  const authStatus =
    pipeline.authorization === "autorizada"
      ? `Autorizada${pipeline.authorizedAt ? ` em ${fmtDateTime(pipeline.authorizedAt, CLINIC_TIMEZONE)}` : ""}${pipeline.authorizedByName ? ` por ${pipeline.authorizedByName}` : ""}`
      : pipeline.authorization === "dispensada"
        ? "Dispensada — particular / sem guia"
        : sentState === "done"
          ? "Aguardando retorno do plano"
          : "Depende do envio da guia";

  const schedStatus = pipeline.schedulingEnabledAt
    ? `Habilitado em ${fmtDateTime(pipeline.schedulingEnabledAt, CLINIC_TIMEZONE)}`
    : schedState === "locked"
      ? "Depende da autorização"
      : "Pronto para habilitar";

  return (
    <div className="flex flex-col gap-2">
      {pipeline.returned && (
        <div role="status" className="rounded-md border border-status-pending-text/60 bg-status-pending-text/5 px-3 py-2 text-sm text-ink">
          <p className="m-0 font-semibold text-status-pending-text">
            Devolvido pela Supervisão em {fmtDateTime(pipeline.returned.at, CLINIC_TIMEZONE)}
            {pipeline.returned.byName ? ` · ${pipeline.returned.byName}` : ""}
          </p>
          <p className="m-0 mt-0.5 whitespace-pre-wrap">{pipeline.returned.reason}</p>
        </div>
      )}
    <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
      <StepShell index={1} state={docState} status={`${draft.files.length} arquivo(s) · ${draft.facts.length} dado(s) lido(s)`}>
        {documents}
      </StepShell>

      <Arrow />

      <StepShell index={2} state={sentState} status={sentStatus}>
        {pipeline.authorization === "pendente" && (
          <>
            <p className="m-0 text-sm text-ink-faint">
              Envie a guia de autorização ao plano (portal, e-mail ou telefone) e marque aqui.
            </p>
            {missingLabels.length > 0 && (
              <p className="m-0 text-sm text-status-pending-text">Ainda falta: {missingLabels.join(", ")}.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <StepButton primary onClick={handleMarkGuideSent} disabled={isPending}>
                Guia enviada ao plano
              </StepButton>
              {!draft.pendencies.hasPlan && (
                <StepButton onClick={() => run(() => waiveDraftAuthorization(draft.id))} disabled={isPending}>
                  Particular / sem guia
                </StepButton>
              )}
            </div>
          </>
        )}

        {pipeline.authorization === "enviada" && (
          <div>
            <StepButton onClick={() => run(() => undoGuideSent(draft.id))} disabled={isPending}>
              Desfazer
            </StepButton>
          </div>
        )}

        {(pipeline.authorization === "autorizada" || pipeline.authorization === "dispensada") && (
          <p className="m-0 text-sm text-ink-faint">
            {pipeline.authorization === "autorizada" ? "Concluída — o plano já respondeu." : "Não se aplica a este atendimento."}
          </p>
        )}
      </StepShell>

      <Arrow />

      <StepShell index={3} state={authState} status={authStatus}>
        {(pipeline.authorization === "enviada" || pipeline.authorization === "pendente") && (
          <>
            <p className="m-0 text-sm text-ink-faint">
              Confira a autorização junto ao plano (portal ou telefone). Quando o plano autorizar, suba a guia em PDF: o sistema
              habilita o agendamento e abre o WhatsApp com o aviso ao responsável.
            </p>
            <div className="flex flex-wrap gap-2">
              <StepButton primary onClick={() => setShowGuideDialog(true)} disabled={isPending}>
                Plano autorizou
              </StepButton>
              {!draft.pendencies.hasPlan && (
                <StepButton onClick={() => run(() => waiveDraftAuthorization(draft.id))} disabled={isPending}>
                  Particular / sem guia
                </StepButton>
              )}
            </div>
            {showGuideDialog && (
              <AuthorizedGuideDialog
                suggestedGuide={pipeline.suggestedGuide}
                pending={isPending}
                error={dialogError}
                onClose={() => setShowGuideDialog(false)}
                onConfirm={confirmAuthorized}
              />
            )}
          </>
        )}

        {pipeline.authorization === "autorizada" && (
          <>
            {guide && (
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
                <dt className="text-[13px] uppercase tracking-wide text-ink-soft">Guia</dt>
                <dd className="m-0 text-ink">{guide.guide_number ?? "—"}</dd>
                {guide.procedures.length > 0 ? (
                  guide.procedures.map((p) => (
                    <div key={p.code} className="contents">
                      <dt className="text-[13px] uppercase tracking-wide text-ink-soft">{p.code}</dt>
                      <dd className="m-0 text-ink">
                        {p.description || "—"} · {p.quantity}
                      </dd>
                    </div>
                  ))
                ) : (
                  <>
                    <dt className="text-[13px] uppercase tracking-wide text-ink-soft">Procedimento</dt>
                    <dd className="m-0 text-ink">{guide.procedure_code ?? "—"}</dd>
                    <dt className="text-[13px] uppercase tracking-wide text-ink-soft">Sessões</dt>
                    <dd className="m-0 text-ink">{guide.sessions_authorized ?? "—"}</dd>
                  </>
                )}
                <dt className="text-[13px] uppercase tracking-wide text-ink-soft">Válida até</dt>
                <dd className="m-0 text-ink">{fmtDate(guide.valid_to)}</dd>
              </dl>
            )}
            <p className="m-0 text-sm text-ink-faint">
              {pipeline.authorizationId
                ? "Guia gravada no prontuário do paciente."
                : "Guia guardada no contato — entra no cadastro quando você conferir os dados."}
            </p>
            <div className="flex flex-wrap gap-2">
              {resendUrl && (
                <a
                  href={resendUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-[13px] font-semibold text-ink no-underline hover:bg-paper-subtle"
                >
                  Avisar responsável no WhatsApp
                </a>
              )}
              {!pipeline.schedulingEnabledAt && (
                <StepButton onClick={() => run(() => undoDraftAuthorization(draft.id))} disabled={isPending}>
                  Desfazer
                </StepButton>
              )}
            </div>
          </>
        )}

        {pipeline.authorization === "dispensada" && !pipeline.schedulingEnabledAt && (
          <div>
            <StepButton onClick={() => run(() => undoDraftAuthorization(draft.id))} disabled={isPending}>
              Desfazer
            </StepButton>
          </div>
        )}
      </StepShell>

      <Arrow />

      <StepShell index={4} state={schedState} status={schedStatus}>
        {schedState === "locked" && (
          <p className="m-0 text-sm text-ink-faint">
            Só libera depois que o plano autorizar (ou a autorização for dispensada).
          </p>
        )}

        {schedState === "current" && (
          <>
            <p className="m-0 text-sm text-ink-faint">
              Ao habilitar, a Supervisão passa a ver o “ok” na Agenda 1ª Avaliação e pode marcar.
            </p>
            <div>
              <StepButton primary onClick={() => run(() => enableDraftScheduling(draft.id))} disabled={isPending}>
                {isPending ? "Salvando…" : "Habilitar para agendamento"}
              </StepButton>
            </div>
          </>
        )}

        {schedState === "done" && (
          <>
            <p className="m-0 text-sm text-ink-faint">A Supervisão já vê o “ok” na Agenda 1ª Avaliação.</p>
            <div>
              <StepButton onClick={() => run(() => disableDraftScheduling(draft.id))} disabled={isPending}>
                Retirar habilitação
              </StepButton>
            </div>
          </>
        )}

        {schedState !== "locked" && !pipeline.registered && (
          <p className="m-0 text-sm text-ink-soft">
            O paciente só aparece na agenda depois que o cadastro for conferido.{" "}
            <Link
              href={`/recepcao/pre-cadastros/${draft.id}`}
              className="font-semibold no-underline"
              style={{ color: "var(--color-accent)" }}
            >
              Conferir e cadastrar →
            </Link>
          </p>
        )}
      </StepShell>

      {feedback && (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`m-0 text-sm md:col-span-7 ${feedback.tone === "error" ? "text-status-negative-text" : "text-ink-soft"}`}
        >
          {feedback.text}
        </p>
      )}
    </div>
    </div>
  );
}
