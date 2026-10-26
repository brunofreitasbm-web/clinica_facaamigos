import Link from "next/link";
import { AlertCircle, CheckSquare } from "lucide-react";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import type { PendingQueueItem } from "@/lib/reception-queue";
import { fmtDueShort, fmtWaitingDays } from "@/lib/format";
import { RegisterContactButton } from "./register-contact-button";
import { ResolveAutoFaltaButton } from "./resolve-auto-falta-button";
import { ResolveSimpleButton } from "./resolve-simple-button";
import { AuthorizeRenewalButton } from "./authorize-renewal-button";
import { ResolveRenewalRequestButton } from "./resolve-renewal-request-button";
import { ReassignOwnerButton } from "./reassign-owner-button";
import { resolveRescheduleRequest } from "./actions";
import { DraftIntakeCard } from "./draft-intake-card";
import { DraftPipelineMini } from "./draft-pipeline";
import { SummaryChip } from "./pendency-pills";
import type { QueueStage, WorkspaceItem } from "./queue-workspace";
import { normalizeSearch, urgencyBand } from "./queue-filters-pure";
import { MoveToLastButton } from "./move-to-last-button";
import { formatPhoneDisplay } from "@/lib/whatsapp-leads-view";

type PendencyGuidance = {
  problemTitle: string;
  problemDescription: string;
  actionTitle: string;
  actionSteps: string[];
  actionButtonText?: string;
};

function getPendencyGuidance(category: string, detail: string): PendencyGuidance {
  switch (category) {
    case "guia_vencendo":
      return {
        problemTitle: "Guia prestes a vencer",
        problemDescription: `A autorização do convênio está próxima do vencimento (${detail}). Sem uma nova guia autorizada, os próximos atendimentos não serão cobertos pelo plano.`,
        actionTitle: "Ação necessária para renovar a guia:",
        actionSteps: [
          "Verifique se a família já entregou novo pedido/laudo médico recente.",
          "Solicite a renovação junto ao convênio ou contate o responsável para pedir novo encaminhamento.",
          "Abra a ficha do paciente para lançar os dados da nova guia autorizada.",
        ],
        actionButtonText: "Abrir ficha e gerenciar guias",
      };
    case "guia_poucas_sessoes":
      return {
        problemTitle: "Poucas sessões autorizadas restantes",
        problemDescription: `O saldo de sessões autorizadas está no fim (${detail}). O paciente corre risco de interrupção nas terapias.`,
        actionTitle: "Ação necessária para solicitar novo lote:",
        actionSteps: [
          "Solicite ao terapeuta o relatório evolutivo atualizado para embasar a renovação.",
          "Encaminhe o pedido de extensão de sessões para o convênio.",
          "Acompanhe a autorização e registre o novo saldo na ficha.",
        ],
        actionButtonText: "Abrir ficha do paciente",
      };
    case "cadastro_incompleto":
      return {
        problemTitle: "Cadastro incompleto / Parado",
        problemDescription: `O cadastro do paciente está parado nesta etapa há vários dias (${detail}), sem dados pessoais ou documentação necessária concluída.`,
        actionTitle: "Ação necessária para completar o cadastro:",
        actionSteps: [
          "Acesse a ficha cadastral e confira os campos obrigatórios vazios (CPF, responsável, dados do convênio).",
          "Faça contato com a família via telefone/WhatsApp para colher as informações faltantes.",
          "Preencha os dados e libere o paciente para avaliação ou início dos atendimentos.",
        ],
        actionButtonText: "Completar cadastro do paciente",
      };
    case "evolucao_atrasada":
      return {
        problemTitle: "Evolução clínica atrasada (> 24h)",
        problemDescription: `A sessão foi realizada (${detail}), porém a nota de evolução do prontuário ainda não foi registrada pelo terapeuta no prazo legal de 24h.`,
        actionTitle: "Ação necessária para regularizar o prontuário:",
        actionSteps: [
          "Localize o terapeuta responsável pelo atendimento.",
          "Envie um lembrete solicitando a elaboração e assinatura da evolução no sistema.",
          "Se persistir, comunique a supervisão clínica para alinhamento.",
        ],
        actionButtonText: "Abrir agenda do dia",
      };
    case "documento_vencido":
      return {
        problemTitle: "Documento obrigatório vencido",
        problemDescription: `Um documento essencial do paciente expirou (${detail}) e precisa de renovação para manter a regularidade do prontuário.`,
        actionTitle: "Ação necessária para atualizar o documento:",
        actionSteps: [
          "Verifique qual documento expirou na aba de Documentos do paciente.",
          "Envie mensagem ao responsável solicitando o envio do documento atualizado em foto/PDF.",
          "Faça o upload do documento no prontuário do paciente.",
        ],
        actionButtonText: "Abrir documentos do paciente",
      };
    case "interessado_sem_retorno":
      return {
        problemTitle: "Interessado aguardando retorno humano",
        problemDescription: `Novo contato de família (${detail}) sem primeiro atendimento por parte da recepção.`,
        actionTitle: "Ação necessária para acolhimento:",
        actionSteps: [
          "Ligue ou mande mensagem de WhatsApp para acolher a família.",
          "Apresente a clínica, entenda as necessidades da criança e tire dúvidas.",
          "Clique em 'Registrar contato' abaixo para computar o retorno no sistema.",
        ],
        actionButtonText: "Registrar retorno do contato",
      };
    case "falta_sem_motivo":
      return {
        problemTitle: "Falta sem motivo / Justificativa pendente",
        problemDescription: `O paciente não compareceu à sessão (${detail}) e a falta foi lançada automaticamente sem motivo registrado.`,
        actionTitle: "Ação necessária para apurar a ausência:",
        actionSteps: [
          "Entre em contato com a família para entender o que aconteceu e prestar acolhimento.",
          "Se houver justificativa ou atestado, clique em 'Definir motivo' e selecione a opção correta.",
          "Se o paciente esteve presente ou foi um erro, clique em 'Desfazer falta'.",
        ],
        actionButtonText: "Definir motivo da falta",
      };
    case "remarcacao_solicitada":
      return {
        problemTitle: "Pedido de remarcação de horário",
        problemDescription: `Foi solicitada a remarcação de um atendimento agendado (${detail}).`,
        actionTitle: "Ação necessária para reagendar:",
        actionSteps: [
          "Consulte os horários livres na agenda do terapeuta correspondente.",
          "Combine a nova data com a família.",
          "Atualize o agendamento na agenda e clique em 'Marcar como concluído'.",
        ],
        actionButtonText: "Concluir remarcação",
      };
    case "renovacao_solicitada":
      return {
        problemTitle: "Renovação de guia aguardando retorno do plano",
        problemDescription: `Pedido de renovação enviado ao plano de saúde (${detail}).`,
        actionTitle: "Ação necessária para conferência:",
        actionSteps: [
          "Acesse o portal da operadora e verifique se a autorização foi liberada.",
          "Se liberada, clique em 'Autorizado' para cadastrar a nova guia com número e vigência.",
          "Marque a solicitação como resolvida para concluir a pendência.",
        ],
        actionButtonText: "Registrar guia autorizada",
      };
    case "chegada_nao_confirmada":
      return {
        problemTitle: "Paciente aguardando confirmação no balcão",
        problemDescription: `O paciente realizou check-in presencial (${detail}) e está aguardando na recepção.`,
        actionTitle: "Ação necessária na recepção:",
        actionSteps: [
          "Identifique o paciente e responsável presentes no balcão.",
          "Acesse a tela de Chegadas e confirme a entrada para liberar o acesso e notificar a equipe.",
        ],
        actionButtonText: "Ir para Chegadas",
      };
    default:
      return {
        problemTitle: "Pendência administrativa",
        problemDescription: detail,
        actionTitle: "Ação necessária:",
        actionSteps: [
          "Abra a ficha do paciente para verificar o histórico e o status atual.",
          "Tome a providência administrativa necessária e atualize o registro.",
        ],
        actionButtonText: "Abrir e resolver",
      };
  }
}

function getDraftGuidance(draft: NonNullable<PendingQueueItem["draft"]>): PendencyGuidance {
  const missing = draft.pendencies.missingCount;
  if (missing > 0) {
    const missingLabels = draft.pendencies.pills.filter((p) => p.state === "faltando").map((p) => p.label);
    return {
      problemTitle: `Falta ${missing === 1 ? "1 documento/dado" : `${missing} documentos/dados`}`,
      problemDescription: `Rascunho de pré-cadastro incompleto via WhatsApp. Pendente: ${missingLabels.join(", ") || "documentos obrigatórios"}.`,
      actionTitle: "Ação necessária para obter os documentos:",
      actionSteps: [
        "Envie mensagem via WhatsApp pelos botões rápidos abaixo solicitando os arquivos faltantes.",
        "Aguarde o envio dos documentos pela família e confira os arquivos recebidos.",
        "Com todos os documentos em mãos, avance para a conferência e autorização do plano.",
      ],
      actionButtonText: "Conferir e cadastrar",
    };
  }

  if (draft.pipeline.authorization === "pendente" || draft.pipeline.authorization === "enviada") {
    return {
      problemTitle: "Documentos prontos · Aguardando plano de saúde",
      problemDescription: "Todos os documentos foram recebidos. A guia precisa ser enviada e aprovada pelo plano.",
      actionTitle: "Ação necessária junto ao plano:",
      actionSteps: [
        "Envie a guia médica ao convênio e clique em 'Marcar como enviada' na linha do tempo.",
        "Ao receber o retorno da operadora, registre a guia autorizada ou dispense a guia.",
        "Habilite o agendamento para a supervisão marcar a 1ª avaliação.",
      ],
      actionButtonText: "Avançar autorização",
    };
  }

  return {
    problemTitle: "Autorizado · Pronto para agendar",
    problemDescription: "A autorização do convênio foi concluída com sucesso. Falta liberar o agendamento.",
    actionTitle: "Ação para liberar agendamento:",
    actionSteps: [
      "Confira os dados do paciente para garantir que o prontuário está consistente.",
      "Clique em 'Habilitar agendamento' na linha do tempo abaixo para disponibilizar o contato à supervisão.",
    ],
    actionButtonText: "Habilitar agendamento",
  };
}

/**
 * Converte a fila da recepção nos itens do <QueueWorkspace> (lista + painel de
 * detalhe). Compartilhado entre a Fila de pendências e a tela "À autorizar".
 */

export function draftStage(item: PendingQueueItem): QueueStage | null {
  if (!item.draft) return null;
  const pipeline = item.draft.pipeline;
  if (item.draft.pendencies.missingCount > 0) return "docs";
  if (pipeline?.schedulingEnabledAt) return "liberado";
  if (pipeline?.authorization === "autorizada" || pipeline?.authorization === "dispensada") return "agendar";
  return "autorizacao";
}

function dueText(item: PendingQueueItem): string {
  if (item.escalatedAt) return fmtWaitingDays(item.escalatedAt, CLINIC_TIMEZONE);
  if (item.overdue && item.dueAt) return `atrasado · ${fmtDueShort(item.dueAt, CLINIC_TIMEZONE)}`;
  if (item.dueAt) {
    const isPostponed = new Date(item.dueAt).getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000;
    if (isPostponed) return "no fim da fila";
    return fmtDueShort(item.dueAt, CLINIC_TIMEZONE);
  }
  return item.urgencyLabel;
}

/** Ação que resolve a pendência ali mesmo; `null` quando o caminho é abrir a ficha. */
function primaryAction(item: PendingQueueItem) {
  const { category } = item;
  if (category === "interessado_sem_retorno" && item.patientId) return <RegisterContactButton patientId={item.patientId} />;
  if (category === "falta_sem_motivo" && item.appointmentId) return <ResolveAutoFaltaButton appointmentId={item.appointmentId} />;
  if (category === "remarcacao_solicitada" && item.rescheduleRequestId)
    return (
      <ResolveSimpleButton
        id={item.rescheduleRequestId}
        label="Marcar como concluído"
        doneLabel="Concluído"
        action={resolveRescheduleRequest}
      />
    );
  if (category === "renovacao_solicitada" && item.renewalRequestId)
    return (
      <div className="flex flex-wrap items-start justify-end gap-2">
        {item.renewalPending && <AuthorizeRenewalButton patientName={item.patientName} pending={item.renewalPending} />}
        <ResolveRenewalRequestButton requestId={item.renewalRequestId} />
      </div>
    );
  return null;
}

export function buildWorkspaceItems(
  queue: PendingQueueItem[],
  ctx: { reassignCandidates: { id: string; full_name: string }[] | null; userId: string | null },
): WorkspaceItem[] {
  const { reassignCandidates } = ctx;
  const user = ctx.userId ? { id: ctx.userId } : null;
  const now = new Date();
    return queue.map((item) => {
    const draft = item.draft;
    const escalated = Boolean(item.escalatedAt);
    const overdue = escalated || Boolean(item.overdue);
    const stage = draftStage(item);
    const action = primaryAction(item);
    const due = dueText(item);

    const guidance = draft ? getDraftGuidance(draft) : getPendencyGuidance(item.category, item.detail);
    const isPostponed = item.dueAt ? new Date(item.dueAt).getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000 : false;
    const phone = draft?.sourcePhone ? formatPhoneDisplay(draft.sourcePhone) : null;
    const showPhoneBesideName = phone && item.patientName !== phone;

    const detail = (
      <article key={item.id} className="flex flex-col gap-4">
        <header className="flex flex-col gap-2 border-b border-paper-line pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="m-0 text-2xl font-extrabold leading-tight text-ink">{item.patientName}</h2>
              {showPhoneBesideName && (
                <span className="inline-flex items-center rounded-md border border-paper-line bg-paper-surface px-2.5 py-1 text-sm font-semibold text-ink-soft">
                  {phone}
                </span>
              )}
              <MoveToLastButton
                itemId={item.id}
                patientName={item.patientName}
                isPostponed={isPostponed}
              />
            </div>
            {draft && draft.status !== "validated" && (
              <Link href={`/recepcao/pre-cadastros/${draft.id}`} className="btn btn-primary no-underline">
                Conferir e cadastrar →
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-paper-line-strong px-3 py-1 font-semibold text-ink">{item.categoryLabel}</span>
            {draft?.mergedDraftsCount && draft.mergedDraftsCount > 1 && (
              <span className="rounded-full bg-paper-line px-2.5 py-1 text-xs font-semibold text-ink-soft">
                {draft.mergedDraftsCount} conversas unificadas
              </span>
            )}
            {draft && <SummaryChip pendencies={draft.pendencies} />}
            {draft && <DraftPipelineMini pipeline={draft.pipeline} />}
          </div>
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink-soft">
            <span>
              Dono: <strong className="text-ink">{item.assignedToName ?? "Sem dono"}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className={overdue ? "font-bold text-status-negative-text" : undefined}>
              {item.dueAt || escalated ? due : "sem prazo"}
            </span>
            {reassignCandidates && reassignCandidates.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <ReassignOwnerButton
                  itemId={item.id}
                  currentAssigneeId={item.assignedToId ?? null}
                  candidates={reassignCandidates}
                />
              </>
            )}
          </p>
        </header>

        {/* Bloco 1: Qual a pendência que precisa ser resolvida */}
        <section className="rounded-xl border border-status-pending-line bg-paper-surface p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-pending-soft px-2.5 py-0.5 text-xs font-bold text-status-pending-text">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Pendência a resolver
            </span>
            <span className="text-xs font-semibold text-ink-faint">·</span>
            <span className="text-xs font-medium text-ink-soft">{item.categoryLabel}</span>
          </div>
          <h3 className="m-0 text-base font-bold text-ink">{guidance.problemTitle}</h3>
          <p className="m-0 mt-1.5 text-sm leading-relaxed text-ink-soft">{guidance.problemDescription}</p>
        </section>

        {/* Bloco 2: Ação para fazer */}
        <section className="rounded-xl border border-paper-line-strong bg-paper p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-accent)]">
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Ação para fazer
            </span>
          </div>
          <p className="m-0 text-sm font-semibold text-ink">{guidance.actionTitle}</p>
          <ol className="m-0 mt-2 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-ink-soft">
            {guidance.actionSteps.map((step, idx) => (
              <li key={idx}>
                <span className="text-ink">{step}</span>
              </li>
            ))}
          </ol>

          {!draft && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-paper-line pt-3">
              {action}
              {item.patientId && (
                <Link href={item.href} className={`btn ${action ? "btn-secondary" : "btn-primary"} no-underline`}>
                  {guidance.actionButtonText || (action ? "Abrir ficha" : "Abrir e resolver")} →
                </Link>
              )}
              {!action && !item.patientId && (
                <Link href={item.href} className="btn btn-primary no-underline">
                  {guidance.actionButtonText || "Abrir e resolver"} →
                </Link>
              )}
            </div>
          )}
        </section>

        {draft && <DraftIntakeCard draft={draft} focus hideReviewLink />}
      </article>
    );

    const missingLabels = draft
      ? draft.pendencies.pills.filter((p) => p.state === "faltando").map((p) => `falta ${p.label}`)
      : [];

    return {
      id: item.id,
      category: item.category,
      categoryLabel: item.categoryLabel,
      name: item.patientName,
      band: urgencyBand({ category: item.category, overdue, escalated, dueAt: item.dueAt ?? null }, now, CLINIC_TIMEZONE),
      overdue,
      escalated,
      dueAt: item.dueAt ?? null,
      dueText: due,
      ownerId: item.assignedToId ?? null,
      ownerName: item.assignedToName ?? null,
      stage,
      missingCount: draft ? draft.pendencies.missingCount : null,
      mine: Boolean(user && item.assignedToId === user.id),
      haystack: normalizeSearch(
        [
          item.patientName,
          item.detail,
          item.categoryLabel,
          item.urgencyLabel,
          item.assignedToName,
          draft?.patientName,
          draft?.sourcePhone,
          ...(draft?.facts.map((f) => f.value) ?? []),
          ...missingLabels,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      readDraftId:
        draft && (draft.status === "pending" || draft.status === "failed") && draft.files.length > 0 ? draft.id : null,
      isPostponed,
      detail,
    };
  });
}
