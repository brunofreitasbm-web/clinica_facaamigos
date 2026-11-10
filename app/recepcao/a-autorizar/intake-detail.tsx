"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, FileText, Image as ImageIcon, MoreHorizontal } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import type { PendingRegistrationDraft } from "@/lib/reception-queue";
import { missingChaseKeys, visiblePills, type PillState } from "@/lib/lead-pendencies";
import { toIntakeInput } from "@/lib/intake-queue-build-pure";
import { OPEN_STATUSES } from "@/lib/portal-robot-pure";
import { formatPhoneDisplay } from "@/lib/whatsapp-leads-view";
import { buildPlanAuthorizedMessage, buildWhatsappLink } from "@/lib/whatsapp-message";
import { chatHref, showChatLink } from "@/lib/atendimento/chat-deep-link-pure";
import {
  disableDraftScheduling,
  enableDraftScheduling,
  markGuideSent,
  registerAuthorizedGuide,
  undoDraftAuthorization,
  undoGuideSent,
  waiveDraftAuthorization,
} from "../pacientes/pendencias/draft-pipeline-actions";
import { getPortalRobotState } from "../pacientes/pendencias/portal-robot-actions";
import { AuthorizedGuideDialog, type GuideValues } from "../pacientes/pendencias/draft-pipeline";
import { PortalRobotPanel, PortalRobotRequestDialog } from "../pacientes/pendencias/portal-robot-panel";
import { DocumentRequestButtons } from "../pacientes/pendencias/document-request-buttons";
import { DraftAdjustButton } from "../pacientes/pendencias/draft-adjust-dialog";
import { ReassignOwnerButton } from "../pacientes/pendencias/reassign-owner-button";
import { primaryAction } from "./intake-primary-action-pure.ts";
import { IntakeStageTrail } from "./intake-stage-trail.tsx";
import { IntakeCopyField } from "./intake-copy-field.tsx";

/**
 * Detalhe de um caso da Fila de entrada, em coluna única de cima para baixo:
 * cabeçalho do paciente (dados em linha inteira com Copiar, menu "Mais"), trilha de etapas com a
 * etapa atual aberta e um único botão principal, e "Dados recebidos" recolhido.
 *
 * Usado só pela Fila de entrada. O Chat (Atendimento) e Pendências continuam com o DraftIntakeCard;
 * aqui só se reaproveitam as mesmas ações de servidor e diálogos.
 */

type ActionResult = { success: true; note?: string; offer?: "sent" | "duplicate" | "failed" } | { success: false; error: string };

type RobotView = { loaded: boolean; online: boolean; jobOpen: boolean };

const ROBOT_POLL_MS = 20_000;

const PLACEHOLDER_TITLE = "Disponível na próxima etapa";

const PILL_TEXT: Record<PillState, string> = {
  faltando: "Falta",
  aviso: "Atenção",
  analisando: "Em leitura",
  ok: "Recebido",
  nao_se_aplica: "Não se aplica",
};

const PILL_TONE: Record<PillState, string> = {
  faltando: "text-rose-700",
  aviso: "text-amber-800",
  analisando: "text-slate-600",
  ok: "text-emerald-700",
  nao_se_aplica: "text-slate-500",
};

const PILL_SYMBOL: Record<PillState, string> = {
  faltando: "✗",
  aviso: "!",
  analisando: "…",
  ok: "✓",
  nao_se_aplica: "-",
};

function PrimaryButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

const SECONDARY_CLASS =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 no-underline transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:cursor-not-allowed disabled:opacity-50";

function SecondaryButton({
  children,
  onClick,
  disabled,
  title,
  expanded,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  expanded?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-expanded={expanded} className={SECONDARY_CLASS}>
      {children}
    </button>
  );
}

/** Menu "Mais" do cabeçalho. O painel só fica escondido (não desmonta) para o diálogo de Ajustar cadastro seguir aberto. */
function MoreMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const hasDialog = () => Boolean(ref.current?.querySelector('[role="dialog"]'));
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !hasDialog()) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !hasDialog()) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={SECONDARY_CLASS}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        Mais
      </button>
      <div
        hidden={!open}
        className="absolute right-0 z-20 mt-1 flex w-64 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
      >
        {children}
      </div>
    </div>
  );
}

export function IntakeDetail({
  item,
  draft,
  reassignCandidates,
  nextItemId,
  onNext,
  onBack,
}: {
  item: { id: string; name: string; ownerId: string | null; ownerName: string | null };
  draft: PendingRegistrationDraft;
  reassignCandidates: { id: string; full_name: string }[];
  /** Próximo caso da aba, para o botão "Próximo caso" depois de concluir. */
  nextItemId: string | null;
  onNext: (id: string) => void;
  /** Só no celular: volta para a lista. */
  onBack: () => void;
}) {
  const router = useRouter();
  const { pipeline, pendencies } = draft;
  const stage = draft.intake.stage;
  const hasPlan = pendencies.hasPlan;

  const [feedback, setFeedback] = useState<{ tone: "error" | "note"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showChase, setShowChase] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRobotDialog, setShowRobotDialog] = useState(false);
  const [showGuideDialog, setShowGuideDialog] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [robotKey, setRobotKey] = useState(0);
  const [robot, setRobot] = useState<RobotView>({ loaded: false, online: false, jobOpen: false });

  // Robô do portal: só importa na etapa 2 de quem tem plano. A tela consulta o estado sozinha
  // e troca o rótulo do botão principal quando o robô liga ou desliga.
  const needsRobot = stage === 2 && hasPlan;
  useEffect(() => {
    if (!needsRobot) return;
    let alive = true;
    const load = async () => {
      const res = await getPortalRobotState(draft.id);
      if (!alive) return;
      if (!res.success) {
        setRobot((r) => ({ ...r, loaded: true }));
        return;
      }
      const job = res.state.job;
      setRobot({ loaded: true, online: res.state.agentOnline, jobOpen: job ? OPEN_STATUSES.includes(job.status) : false });
    };
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(load, ROBOT_POLL_MS);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [draft.id, needsRobot, robotKey]);

  const robotOnline = needsRobot && robot.online;
  const action = primaryAction(toIntakeInput(draft), robotOnline);

  const run = (fn: () => Promise<ActionResult>) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) {
        setFeedback({ tone: "error", text: result.error });
        return;
      }
      router.refresh();
      if (result.note) setFeedback({ tone: "note", text: result.note });
    });
  };

  // Dados do cabeçalho
  const fact = (label: string) => draft.facts.find((f) => f.label === label)?.value ?? null;
  const rawPhone = fact("Telefone") ?? draft.sourcePhone;
  const phone = rawPhone ? formatPhoneDisplay(rawPhone) : null;
  const plan = [fact("Plano de saúde"), fact("Plano")].filter(Boolean).join(" · ") || null;
  const card = fact("Carteirinha");
  const chatLink =
    showChatLink({ source: draft.source, sourcePhone: draft.sourcePhone, inChat: false }) && draft.sourcePhone
      ? chatHref({ phone: draft.sourcePhone })
      : null;

  // O que falta
  const pills = visiblePills(pendencies);
  const missingPills = pills.filter((p) => p.state === "faltando");

  // Aviso à família pelo WhatsApp com a guia autorizada (mesma mensagem do fluxo antigo).
  const guide = pipeline.authorizedGuide;
  const buildAuthorizedUrl = (procedures: { description: string; quantity: number }[], validUntil: string | null) =>
    rawPhone
      ? buildWhatsappLink(
          rawPhone,
          buildPlanAuthorizedMessage({
            guardianName: fact("Responsável"),
            patientName: draft.patientName ?? fact("Criança"),
            procedures,
            validUntil,
          }),
        )
      : null;
  const resendUrl = guide && guide.procedures.length > 0 ? buildAuthorizedUrl(guide.procedures, guide.valid_to) : null;

  // Etapa 3, "Subir guia autorizada (PDF)": reaproveita o diálogo e o leitor de PDF do fluxo antigo
  // (AuthorizedGuideDialog + parseAuthorizedGuidePdf, sem IA). O que já acontece ao salvar:
  //   1. registerAuthorizedGuide grava a guia (etapa 3 concluída);
  //   2. enableDraftScheduling habilita o agendamento (etapa 4) e o servidor dispara sozinho a oferta
  //      de 3 horários da 1ª avaliação pelo WhatsApp (lib/evaluation-offer.ts);
  //   3. o link wa.me não abre sozinho: fica no botão "Avisar responsável no WhatsApp" caso a oferta falhe.
  // Fica para a Task 5: confirmação da mensagem de WhatsApp antes do envio, aviso com "Desfazer"
  // por 8 segundos e os caminhos "Plano negou" e "Plano pediu mais documentos".
  const confirmAuthorized = (values: GuideValues) => {
    const procedures = values.procedures.map((p) => ({ code: p.code, description: p.description, quantity: Number(p.quantity) }));
    setGuideError(null);
    setFeedback(null);
    startTransition(async () => {
      const saved = await registerAuthorizedGuide(draft.id, {
        guideNumber: values.guideNumber,
        validTo: values.validTo,
        procedures,
      });
      if (!saved.success) {
        setGuideError(saved.error);
        return;
      }
      const enabled = await enableDraftScheduling(draft.id);
      setShowGuideDialog(false);
      router.refresh();
      if (!enabled.success) {
        setFeedback({ tone: "error", text: `Guia salva, mas não foi possível habilitar o agendamento: ${enabled.error}` });
      } else {
        const note = [saved.note, enabled.note].filter(Boolean).join(" ");
        if (note) setFeedback({ tone: enabled.offer === "failed" ? "error" : "note", text: note });
      }
    });
  };

  const onPrimary = () => {
    switch (action.kind) {
      case "send_via_robot":
        setShowRobotDialog(true);
        return;
      case "mark_sent":
        run(() => markGuideSent(draft.id));
        return;
      case "upload_authorized_pdf":
        setGuideError(null);
        setShowGuideDialog(true);
        return;
      case "none":
        return;
    }
  };

  const who = (at: string | null, by: string | null) =>
    `${at ? ` em ${fmtDateTime(at, CLINIC_TIMEZONE)}` : ""}${by ? ` por ${by}` : ""}`;

  const sentLine =
    pipeline.authorization === "dispensada"
      ? "Dispensada, particular sem guia"
      : pipeline.guideSentAt
        ? `Enviada${who(pipeline.guideSentAt, pipeline.guideSentByName)}`
        : "Sem registro de envio";
  const authLine =
    pipeline.authorization === "dispensada"
      ? "Dispensada, particular sem guia"
      : `Autorizada${who(pipeline.authorizedAt, pipeline.authorizedByName)}`;

  // Lista "O que falta": aparece uma única vez, dentro da etapa 1. Ainda não existe ação no servidor
  // para marcar um documento como recebido à mão, então a lista é só leitura; o estado vem de
  // lib/lead-pendencies.ts e muda sozinho quando o arquivo chega.
  const missingList = (
    <div className="flex flex-col gap-1">
      <h4 className="m-0 text-sm font-semibold text-slate-900">O que falta</h4>
      {pills.length === 0 ? (
        <p className="m-0 text-sm text-slate-600">Nada para conferir ainda.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {pills.map((pill) => (
            <li key={pill.key} className="flex min-h-10 items-center gap-2 border-t border-slate-100 text-sm first:border-t-0">
              <span aria-hidden="true" className={`w-4 text-center font-bold ${PILL_TONE[pill.state]}`}>
                {PILL_SYMBOL[pill.state]}
              </span>
              <span className="min-w-0 flex-1 text-slate-900">
                {pill.label}
                {pill.detail ? <span className="text-slate-600"> ({pill.detail})</span> : null}
              </span>
              <span className={`shrink-0 font-semibold ${PILL_TONE[pill.state]}`}>{PILL_TEXT[pill.state]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Ações secundárias das etapas 1 e 2. "Cobrar o que falta" ainda abre os botões de cobrança por
  // documento; a mensagem única com todos os itens chega na Task 5.
  const chaseActions = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <SecondaryButton onClick={() => setShowChase((v) => !v)} expanded={showChase}>
          Cobrar o que falta
        </SecondaryButton>
        {chatLink && (
          <Link href={chatLink} className={SECONDARY_CLASS}>
            Abrir conversa
          </Link>
        )}
      </div>
      {showChase && (
        <DocumentRequestButtons
          draftId={draft.id}
          patientName={draft.patientName}
          hasPhone={Boolean(draft.sourcePhone)}
          requests={draft.documentRequests}
          missingKeys={missingChaseKeys(pendencies)}
        />
      )}
    </div>
  );

  const waiveButton =
    !hasPlan && (pipeline.authorization === "pendente" || pipeline.authorization === "enviada") ? (
      <SecondaryButton onClick={() => run(() => waiveDraftAuthorization(draft.id))} disabled={isPending}>
        Particular, sem guia
      </SecondaryButton>
    ) : null;

  const returnedBanner = pipeline.returned ? (
    <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-slate-900">
      <p className="m-0 font-semibold text-amber-900">
        Devolvido pela Supervisão{who(pipeline.returned.at, pipeline.returned.byName)}
      </p>
      <p className="m-0 mt-0.5 whitespace-pre-wrap">{pipeline.returned.reason}</p>
    </div>
  ) : null;

  const history = [
    { at: draft.createdAt, text: "Contato recebido" },
    ...draft.documentRequests.map((r) => ({ at: r.sentAt, text: "Cobrança de documento enviada à família" })),
    ...(pipeline.guideSentAt ? [{ at: pipeline.guideSentAt, text: `Guia enviada ao plano${pipeline.guideSentByName ? ` por ${pipeline.guideSentByName}` : ""}` }] : []),
    ...(pipeline.authorizedAt ? [{ at: pipeline.authorizedAt, text: `Plano autorizou${pipeline.authorizedByName ? `, registrado por ${pipeline.authorizedByName}` : ""}` }] : []),
    ...(pipeline.schedulingEnabledAt ? [{ at: pipeline.schedulingEnabledAt, text: "Habilitado para agendamento" }] : []),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  let body: ReactNode;
  if (stage === 1) {
    body = (
      <>
        {returnedBanner}
        <p className="m-0 text-slate-700">O plano pediu mais documentos. Confira o que falta e cobre a família.</p>
        {missingList}
        {chaseActions}
      </>
    );
  } else if (stage === 2) {
    const loadingRobot = needsRobot && !robot.loaded;
    body = (
      <>
        {returnedBanner}
        <p className="m-0 text-slate-700">A guia ainda não foi enviada ao plano.</p>
        {/* Task 5: aviso de pendência aqui, colado logo acima do botão principal, com os itens que faltam
            (ex.: "Faltam laudo e pedido médico. O plano pode negar."). Nada bloqueia o envio. */}
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton
            onClick={onPrimary}
            disabled={isPending || loadingRobot || robot.jobOpen}
            title={robot.jobOpen ? "O robô já está enviando esta guia" : undefined}
          >
            {loadingRobot ? "Verificando o robô do portal…" : action.label}
          </PrimaryButton>
          {robotOnline && (
            // Robô ligado, mas a guia foi por outro canal (portal à mão, e-mail, telefone).
            <SecondaryButton onClick={() => run(() => markGuideSent(draft.id))} disabled={isPending || robot.jobOpen}>
              Enviei por outro canal
            </SecondaryButton>
          )}
          {waiveButton}
        </div>
        {needsRobot && robot.loaded && (
          <p className="m-0 flex items-center gap-2 text-sm text-slate-600">
            <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${robot.online ? "bg-emerald-600" : "bg-slate-400"}`} />
            {robot.online
              ? "Robô do portal ligado: ele preenche o portal e para no resumo para você confirmar."
              : "Robô do portal desligado: envie a guia pelo portal do plano e marque aqui."}
          </p>
        )}
        {/* Andamento de um pedido ao robô (fila, preenchendo, resumo para confirmar). Sem pedido, não mostra nada. */}
        {hasPlan && <PortalRobotPanel key={robotKey} draftId={draft.id} canRequest={false} />}
        {chaseActions}
      </>
    );
  } else if (stage === 3) {
    const waitingPlan = pipeline.authorization === "enviada";
    body = waitingPlan ? (
      <>
        <p className="m-0 text-slate-700">Aguardando o retorno do plano. Quando autorizar, suba a guia em PDF.</p>
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={onPrimary} disabled={isPending}>
            {action.label}
          </PrimaryButton>
          {waiveButton}
        </div>
        {/* "Plano negou" e "Plano pediu mais documentos" ficam visíveis, mas o servidor chega na Task 5. */}
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={() => undefined} disabled title={PLACEHOLDER_TITLE}>
            Plano negou
          </SecondaryButton>
          <SecondaryButton onClick={() => undefined} disabled title={PLACEHOLDER_TITLE}>
            Plano pediu mais documentos
          </SecondaryButton>
        </div>
        {hasPlan && <PortalRobotPanel draftId={draft.id} canRequest={false} />}
      </>
    ) : (
      // Guia já registrada (ou dispensada) mas o agendamento não foi habilitado: acontece quando a
      // habilitação falhou depois de salvar a guia. Subir o PDF de novo não faz sentido; o que falta é habilitar.
      <>
        <p className="m-0 text-slate-700">{authLine}. Falta habilitar o agendamento.</p>
        {guide && (
          <p className="m-0 text-slate-700">
            Guia {guide.guide_number ?? "sem número"}
            {guide.valid_to ? `, válida até ${new Date(`${guide.valid_to}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={() => run(() => enableDraftScheduling(draft.id))} disabled={isPending}>
            Habilitar para agendamento
          </PrimaryButton>
          <SecondaryButton onClick={() => run(() => undoDraftAuthorization(draft.id))} disabled={isPending}>
            Desfazer autorização
          </SecondaryButton>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <p className="m-0 font-semibold text-emerald-800">
          Habilitado{pipeline.schedulingEnabledAt ? ` em ${fmtDateTime(pipeline.schedulingEnabledAt, CLINIC_TIMEZONE)}` : ""}. A
          Supervisão já vê o caso na Agenda de 1ª Avaliação.
        </p>
        {!pipeline.registered && (
          <p className="m-0 text-slate-700">
            O paciente só aparece na agenda depois que o cadastro for conferido.{" "}
            <Link href={`/recepcao/pre-cadastros/${draft.id}`} className="font-semibold text-teal-800 underline underline-offset-2">
              Conferir e cadastrar
            </Link>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <a href="/supervisao?tab=agenda1a" target="_blank" rel="noopener noreferrer" className={SECONDARY_CLASS}>
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Abrir Agenda de Avaliações
          </a>
          {resendUrl && (
            <a href={resendUrl} target="_blank" rel="noopener noreferrer" className={SECONDARY_CLASS}>
              Avisar responsável no WhatsApp
            </a>
          )}
          {nextItemId && (
            <SecondaryButton onClick={() => onNext(nextItemId)}>Próximo caso</SecondaryButton>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={() => setShowHistory((v) => !v)} expanded={showHistory}>
            Ver histórico
          </SecondaryButton>
          <SecondaryButton onClick={() => run(() => disableDraftScheduling(draft.id))} disabled={isPending}>
            Retirar habilitação
          </SecondaryButton>
        </div>
        {showHistory && (
          <ol className="m-0 flex list-none flex-col p-0">
            {history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex min-h-10 items-center gap-3 border-t border-slate-100 text-sm first:border-t-0">
                <span className="w-36 shrink-0 tabular-nums text-slate-600">{fmtDateTime(h.at, CLINIC_TIMEZONE)}</span>
                <span className="text-slate-900">{h.text}</span>
              </li>
            ))}
          </ol>
        )}
      </>
    );
  }

  const doneLine = {
    1: missingPills.length > 0 ? `Faltam ${missingPills.length}: ${missingPills.map((p) => p.label).join(", ")}` : "Nada faltando",
    2: sentLine,
    3: authLine,
  };

  const doneExtra = {
    1: missingList,
    // Marcou por engano: desfazer o envio enquanto o plano não respondeu.
    2:
      stage === 3 && pipeline.authorization === "enviada" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-700">Marcou por engano?</span>
          <SecondaryButton onClick={() => run(() => undoGuideSent(draft.id))} disabled={isPending}>
            Desfazer envio
          </SecondaryButton>
        </div>
      ) : undefined,
  };

  return (
    <article className="flex flex-col gap-4">
      {/* Celular: o detalhe ocupa a tela inteira; este botão volta para a lista. */}
      <div className="sticky top-0 z-10 -mx-4 -mt-4 flex border-b border-slate-200 bg-white px-4 py-2 md:hidden">
        <button type="button" onClick={onBack} className={SECONDARY_CLASS}>
          Voltar para a lista
        </button>
      </div>

      {/* Cabeçalho do paciente */}
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 break-words text-xl font-bold leading-tight text-slate-900">{item.name}</h2>
            <p className="m-0 mt-0.5 text-sm text-slate-600">
              Dono: <span className="font-semibold text-slate-800">{item.ownerName ?? "Sem dono"}</span>
            </p>
          </div>
          <MoreMenu>
            {reassignCandidates.length > 0 && (
              // O botão Reatribuir é o mesmo de Pendências; aqui só ganha tamanho de alvo e texto mínimos.
              <div className="flex min-h-10 items-center px-2 [&_button]:min-h-10 [&_button]:text-sm [&_button]:opacity-100 [&_select]:min-h-10 [&_select]:text-sm">
                <ReassignOwnerButton itemId={item.id} currentAssigneeId={item.ownerId} candidates={reassignCandidates} />
              </div>
            )}
            <div className="[&_button]:min-h-10 [&_button]:w-full [&_button]:justify-start [&_button]:text-sm">
              <DraftAdjustButton draftId={draft.id} />
            </div>
            {draft.status !== "validated" && (
              <Link
                href={`/recepcao/pre-cadastros/${draft.id}`}
                className="flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-slate-800 no-underline hover:bg-slate-50"
              >
                Conferir e cadastrar
              </Link>
            )}
            {draft.patientId && draft.patientStatus !== "interessado" && (
              <Link
                href={`/recepcao/pacientes/${draft.patientId}`}
                className="flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-slate-800 no-underline hover:bg-slate-50"
              >
                Abrir prontuário
              </Link>
            )}
          </MoreMenu>
        </div>
        <div className="flex flex-col rounded-xl border border-slate-200 px-3">
          <IntakeCopyField label="Telefone" value={phone} copyValue={rawPhone ?? undefined} />
          <IntakeCopyField label="Plano" value={plan} />
          <IntakeCopyField label="Carteirinha" value={card} />
        </div>
      </header>

      <IntakeStageTrail current={stage} label={draft.intake.label} doneLine={doneLine} doneExtra={doneExtra}>
        {body}
        {feedback && (
          <p
            role={feedback.tone === "error" ? "alert" : "status"}
            className={`m-0 text-sm ${feedback.tone === "error" ? "text-rose-700" : "text-slate-700"}`}
          >
            {feedback.text}
          </p>
        )}
      </IntakeStageTrail>

      {/* Dados recebidos: recolhidos por padrão */}
      <details className="rounded-xl border border-slate-200 text-sm">
        <summary className="flex min-h-10 cursor-pointer items-center px-3 py-2 font-semibold text-slate-900">
          Dados recebidos ({draft.facts.length} {draft.facts.length === 1 ? "dado" : "dados"}, {draft.files.length}{" "}
          {draft.files.length === 1 ? "arquivo" : "arquivos"})
        </summary>
        <div className="flex flex-col gap-4 border-t border-slate-200 px-3 py-3">
          {draft.mergedDraftsCount && draft.mergedDraftsCount > 1 ? (
            <p className="m-0 text-slate-700">Dados e arquivos combinados de {draft.mergedDraftsCount} conversas do mesmo responsável.</p>
          ) : null}
          {draft.guardianMessage && (
            <p className="m-0 text-slate-900">
              <span className="font-semibold">Mensagem da família:</span> {draft.guardianMessage}
            </p>
          )}

          <div className="flex flex-col">
            <h4 className="m-0 mb-1 text-sm font-semibold text-slate-900">Dados lidos</h4>
            {draft.facts.length === 0 ? (
              <p className="m-0 text-slate-600">Nada lido automaticamente ainda.</p>
            ) : (
              <dl className="m-0 flex flex-col">
                {draft.facts.map((f) => (
                  <div key={f.label} className="flex min-h-10 items-center gap-3 border-t border-slate-100 first:border-t-0">
                    <dt className="w-36 shrink-0 text-slate-600">{f.label}</dt>
                    <dd className="m-0 min-w-0 flex-1 break-words text-slate-900 [overflow-wrap:anywhere]">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="flex flex-col">
            <h4 className="m-0 mb-1 text-sm font-semibold text-slate-900">Arquivos</h4>
            {draft.files.length === 0 ? (
              <p className="m-0 text-slate-600">Nenhum arquivo anexado a este contato.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {draft.files.map((file) => {
                  const isImage = (file.mimeType ?? "").startsWith("image/");
                  return (
                    <li key={file.id}>
                      <a
                        href={`/api/arquivos/rascunho/${file.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-10 items-center gap-2 text-teal-800 underline-offset-2 hover:underline"
                      >
                        {isImage ? (
                          <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                        )}
                        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{file.name}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {(draft.warnings.length > 0 || draft.error) && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-rose-700">
              {draft.error && <li>Leitura automática falhou: {draft.error}</li>}
              {draft.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {draft.messages.length > 0 && (
            <div className="flex flex-col">
              <h4 className="m-0 mb-1 text-sm font-semibold text-slate-900">Últimas mensagens</h4>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {draft.messages.map((m, i) => (
                  <li key={`${m.sentAt}-${i}`}>
                    <span className="text-slate-600">
                      {m.direction === "inbound" ? "Família" : "Clínica"}, {fmtDateTime(m.sentAt, CLINIC_TIMEZONE)}:
                    </span>{" "}
                    <span className="text-slate-900">{m.body || (m.hasMedia ? "(arquivo enviado)" : "(sem texto)")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      {showRobotDialog && (
        <PortalRobotRequestDialog
          draftId={draft.id}
          onClose={() => setShowRobotDialog(false)}
          onSent={() => {
            setShowRobotDialog(false);
            // Recarrega o painel do robô e o estado do botão principal (o pedido agora está na fila).
            setRobotKey((k) => k + 1);
          }}
        />
      )}
      {showGuideDialog && (
        <AuthorizedGuideDialog
          suggestedGuide={pipeline.suggestedGuide}
          pending={isPending}
          error={guideError}
          onClose={() => setShowGuideDialog(false)}
          onConfirm={confirmAuthorized}
        />
      )}
    </article>
  );
}
