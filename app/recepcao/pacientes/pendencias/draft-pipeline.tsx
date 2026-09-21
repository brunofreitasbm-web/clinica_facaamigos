"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import type { PendingRegistrationDraft } from "@/lib/reception-queue";
import {
  disableDraftScheduling,
  enableDraftScheduling,
  registerAuthorizedGuide,
  undoDraftAuthorization,
  waiveDraftAuthorization,
} from "./draft-pipeline-actions";

/**
 * Linha do tempo de um contato da fila de pendências, do recebimento dos
 * arquivos até o agendamento:
 *
 *   ① Documentos recebidos → ② Autorização junto ao plano → ③ Habilitado para agendamento
 *
 * ② é processo manual da clínica com o convênio (a recepção só registra o
 * resultado e a guia autorizada); ③ é o "ok" que a Agenda 1ª Avaliação da
 * Supervisão exige antes de deixar marcar (lib/evaluation-agenda.ts).
 */

type StepState = "done" | "current" | "locked";

function stepStates(pipeline: PendingRegistrationDraft["pipeline"]): [StepState, StepState, StepState] {
  const authDone = pipeline.authorization !== "pendente";
  const enabled = Boolean(pipeline.schedulingEnabledAt);
  return ["done", authDone ? "done" : "current", enabled ? "done" : authDone ? "current" : "locked"];
}

const STEP_TITLE = ["Documentos recebidos", "Autorização do plano", "Habilitado p/ agendamento"] as const;

const STATE_STYLE: Record<StepState, string> = {
  done: "border-status-positive-text/60 bg-status-positive-text/5",
  current: "border-[var(--color-accent)] bg-paper",
  locked: "border-dashed border-paper-line-strong bg-paper/40 opacity-80",
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
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        allDone ? "border-status-positive-text/60 text-status-positive-text" : "border-[var(--color-accent)] text-ink"
      }`}
    >
      {allDone ? `✓ ${STEP_TITLE[2]}` : `Etapa ${currentIndex + 1}/3 · ${STEP_TITLE[currentIndex]}`}
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
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            state === "done" ? "bg-status-positive-text text-white" : "border border-paper-line-strong text-ink-soft"
          }`}
        >
          {state === "done" ? "✓" : index + 1}
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-ink-soft">{STEP_TITLE[index - 1]}</h3>
          <p
            className={`m-0 text-[12px] ${
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
      className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
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

function GuideField({
  label,
  name,
  defaultValue,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={type === "number" ? 1 : undefined}
        className="input normal-case tracking-normal"
      />
    </label>
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
  const { pipeline } = draft;
  const [docState, authState, schedState] = stepStates(pipeline);
  const [showGuideForm, setShowGuideForm] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "note"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<{ success: true; note?: string } | { success: false; error: string }>, after?: () => void) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setFeedback({ tone: "error", text: result.error });
        return;
      }
      if (result.note) setFeedback({ tone: "note", text: result.note });
      after?.();
    });
  };

  const guide = pipeline.authorizedGuide;
  const suggestion = pipeline.suggestedGuide;

  // onSubmit (e não <form action>): a action do React limpa o formulário depois
  // de rodar, e um erro de validação apagaria o que a recepção acabou de digitar.
  const onSubmitGuide = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const text = (key: string) => String(formData.get(key) ?? "");
    run(
      () =>
        registerAuthorizedGuide(draft.id, {
          guideNumber: text("guide_number"),
          procedureCode: text("procedure_code"),
          sessionsAuthorized: Number(text("sessions_authorized")),
          validFrom: text("valid_from"),
          validTo: text("valid_to"),
          password: text("password"),
          passwordValidUntil: text("password_valid_until"),
        }),
      () => setShowGuideForm(false),
    );
  };

  const authStatus =
    pipeline.authorization === "autorizada"
      ? `Autorizada${pipeline.authorizedAt ? ` em ${fmtDateTime(pipeline.authorizedAt, CLINIC_TIMEZONE)}` : ""}`
      : pipeline.authorization === "dispensada"
        ? "Dispensada — particular / sem guia"
        : "Aguardando o plano";

  const schedStatus = pipeline.schedulingEnabledAt
    ? `Habilitado em ${fmtDateTime(pipeline.schedulingEnabledAt, CLINIC_TIMEZONE)}`
    : schedState === "locked"
      ? "Depende da autorização"
      : "Pronto para habilitar";

  return (
    <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
      <StepShell index={1} state={docState} status={`${draft.files.length} arquivo(s) · ${draft.facts.length} dado(s) lido(s)`}>
        {documents}
      </StepShell>

      <Arrow />

      <StepShell index={2} state={authState} status={authStatus}>
        {pipeline.authorization === "pendente" && (
          <>
            <p className="m-0 text-[12px] text-ink-faint">
              Confira a autorização junto ao plano (portal ou telefone). Quando o plano autorizar, registre a guia aqui.
            </p>
            {showGuideForm ? (
              <form onSubmit={onSubmitGuide} className="flex flex-col gap-2">
                {suggestion && (
                  <p className="m-0 text-[11px] text-ink-faint">Preenchido com o que foi lido nos arquivos — confira com a guia do plano.</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <GuideField label="Nº da guia" name="guide_number" defaultValue={suggestion?.guide_number ?? ""} required />
                  <GuideField label="Procedimento" name="procedure_code" defaultValue={suggestion?.procedure_code ?? ""} required />
                  <GuideField
                    label="Sessões"
                    name="sessions_authorized"
                    type="number"
                    defaultValue={suggestion?.sessions_authorized ? String(suggestion.sessions_authorized) : ""}
                    required
                  />
                  <GuideField label="Senha" name="password" defaultValue={suggestion?.authorization_password ?? ""} />
                  <GuideField label="Válida de" name="valid_from" type="date" defaultValue={suggestion?.valid_from ?? ""} required />
                  <GuideField label="Válida até" name="valid_to" type="date" defaultValue={suggestion?.valid_to ?? ""} required />
                  <GuideField
                    label="Senha válida até"
                    name="password_valid_until"
                    type="date"
                    defaultValue={suggestion?.password_valid_until ?? ""}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md border-0 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-accent)" }}
                  >
                    {isPending ? "Salvando…" : "Autorizada — salvar guia"}
                  </button>
                  <StepButton onClick={() => setShowGuideForm(false)} disabled={isPending}>
                    Cancelar
                  </StepButton>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <StepButton primary onClick={() => setShowGuideForm(true)} disabled={isPending}>
                  Plano autorizou — registrar guia
                </StepButton>
                <StepButton onClick={() => run(() => waiveDraftAuthorization(draft.id))} disabled={isPending}>
                  Particular / sem guia
                </StepButton>
              </div>
            )}
          </>
        )}

        {pipeline.authorization === "autorizada" && (
          <>
            {guide && (
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
                <dt className="text-xs uppercase tracking-wide text-ink-soft">Guia</dt>
                <dd className="m-0 text-ink">{guide.guide_number ?? "—"}</dd>
                <dt className="text-xs uppercase tracking-wide text-ink-soft">Procedimento</dt>
                <dd className="m-0 text-ink">{guide.procedure_code ?? "—"}</dd>
                <dt className="text-xs uppercase tracking-wide text-ink-soft">Sessões</dt>
                <dd className="m-0 text-ink">{guide.sessions_authorized ?? "—"}</dd>
                <dt className="text-xs uppercase tracking-wide text-ink-soft">Vigência</dt>
                <dd className="m-0 text-ink">
                  {fmtDate(guide.valid_from)} a {fmtDate(guide.valid_to)}
                </dd>
              </dl>
            )}
            <p className="m-0 text-[12px] text-ink-faint">
              {pipeline.authorizationId
                ? "Guia gravada no prontuário do paciente."
                : "Guia guardada no contato — entra no cadastro quando você conferir os dados."}
            </p>
            {!pipeline.schedulingEnabledAt && (
              <div>
                <StepButton onClick={() => run(() => undoDraftAuthorization(draft.id))} disabled={isPending}>
                  Desfazer
                </StepButton>
              </div>
            )}
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

      <StepShell index={3} state={schedState} status={schedStatus}>
        {schedState === "locked" && (
          <p className="m-0 text-[12px] text-ink-faint">
            Só libera depois que o plano autorizar (ou a autorização for dispensada).
          </p>
        )}

        {schedState === "current" && (
          <>
            <p className="m-0 text-[12px] text-ink-faint">
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
            <p className="m-0 text-[12px] text-ink-faint">A Supervisão já vê o “ok” na Agenda 1ª Avaliação.</p>
            <div>
              <StepButton onClick={() => run(() => disableDraftScheduling(draft.id))} disabled={isPending}>
                Retirar habilitação
              </StepButton>
            </div>
          </>
        )}

        {schedState !== "locked" && !pipeline.registered && (
          <p className="m-0 text-[12px] text-ink-soft">
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
          className={`m-0 text-[12px] md:col-span-5 ${feedback.tone === "error" ? "text-status-negative-text" : "text-ink-soft"}`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
