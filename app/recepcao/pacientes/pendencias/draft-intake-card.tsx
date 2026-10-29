import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import type { PendingRegistrationDraft } from "@/lib/reception-queue";
import { FileText, Image as ImageIcon } from "lucide-react";
import { DocumentRequestButtons } from "./document-request-buttons";
import { DraftAdjustButton } from "./draft-adjust-dialog";
import { DraftPipelineColumns } from "./draft-pipeline";
import { PendencyGrid } from "./pendency-pills";
import { missingChaseKeys } from "@/lib/lead-pendencies";

/**
 * Cartão da categoria "cadastro_assistido_ia" na fila de pendências.
 *
 * Substitui a antiga aba "Cadastro IA" (removida de components/recepcao-nav.tsx
 * em 20/09/2026): o contato entra na fila desde o primeiro arquivo, sem
 * esperar a extração automática, e traz junto tudo que a recepção precisa
 * para direcionar — arquivos enviados, dados já lidos e as últimas mensagens
 * da conversa — para não ser preciso abrir o módulo de Atendimento.
 */

const DETECTED_TYPE_LABEL: Record<string, string> = {
  certidao_nascimento: "Certidão de nascimento",
  documento_identidade: "Documento de identidade",
  comprovante_residencia: "Comprovante de residência",
  carteirinha: "Carteirinha do plano",
  autorizacao: "Autorização / guia",
  pedido_medico: "Pedido médico",
  laudo: "Laudo",
  outro: "Outro",
};

function fileLabel(file: PendingRegistrationDraft["files"][number]): string {
  const detected = file.detectedType ? DETECTED_TYPE_LABEL[file.detectedType] ?? file.detectedType : null;
  return detected ? `${detected} · ${file.name}` : file.name;
}

export function DraftIntakeCard({
  draft,
  focus = false,
  hideReviewLink = false,
}: {
  draft: PendingRegistrationDraft;
  focus?: boolean;
  /** O chamador já mostra "Conferir e cadastrar" no cabeçalho, ao lado do nome. */
  hideReviewLink?: boolean;
}) {
  return (
    // Quem recolhe/expande é a linha do contato (CollapsibleQueueRow, em
    // page.tsx): com vários contatos na fila ao mesmo tempo, o cartão aberto
    // empurrava as outras pendências para fora da tela. Com `focus` (painel
    // flutuante do lead, lead-focus-dialog.tsx) o cartão já É a tela — sem
    // borda de encaixe.
    <div className={focus ? "text-sm" : "mt-3 border-t border-paper-line-strong pt-3 text-sm"}>
      <div className="flex flex-col gap-3">
        {draft.mergedDraftsCount && draft.mergedDraftsCount > 1 ? (
          <div className="flex items-center gap-2 rounded-md bg-paper-line/40 px-3 py-1.5 text-xs text-ink-soft">
            <span className="font-bold text-ink">Informações unificadas:</span>
            <span>Dados e arquivos combinados de {draft.mergedDraftsCount} conversas enviadas pelo responsável.</span>
          </div>
        ) : null}

        {draft.guardianMessage && (
          <p className="rounded-md bg-paper-line/40 px-3 py-2 text-ink">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-soft">Mensagem da família: </span>
            {draft.guardianMessage}
          </p>
        )}

        <PendencyGrid pendencies={draft.pendencies} />

        {/* Linha do tempo: documentos → autorização do plano → habilitado para
            agendamento. A coluna 1 é o que antes era o cartão inteiro. */}
        <DraftPipelineColumns
          draft={draft}
          documents={
            <div className="flex flex-col gap-3">
              <div>
                <h4 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                  Arquivos recebidos ({draft.files.length})
                </h4>
                {draft.files.length === 0 ? (
                  <p className="m-0 text-ink-faint">Nenhum arquivo anexado a este contato.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {draft.files.map((file) => {
                      const isImage = (file.mimeType ?? "").startsWith("image/");
                      return (
                        <a
                          key={file.id}
                          href={`/api/arquivos/rascunho/${file.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-paper-line-strong bg-paper px-2.5 py-1 text-xs font-medium text-ink no-underline transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-paper-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                          title={`Abrir ${fileLabel(file)}`}
                        >
                          {isImage ? (
                            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-ink-soft" aria-hidden="true" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 shrink-0 text-ink-soft" aria-hidden="true" />
                          )}
                          <span className="truncate">{fileLabel(file)}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                  Dados já recebidos ({draft.facts.length})
                </h4>
                {draft.facts.length === 0 ? (
                  <p className="m-0 text-ink-faint">
                    Nada lido automaticamente ainda — abra os arquivos acima e a conversa abaixo para conferir.
                  </p>
                ) : (
                  <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2">
                    {draft.facts.map((fact) => {
                      const isLong = String(fact.value).length > 24;
                      return (
                        <div
                          key={fact.label}
                          className={`min-w-0 ${isLong ? "col-span-2" : ""}`}
                        >
                          <dt className="text-[11px] uppercase tracking-wide text-ink-soft">{fact.label}</dt>
                          <dd
                            className="m-0 break-words text-ink [overflow-wrap:anywhere] line-clamp-3"
                            title={String(fact.value)}
                          >
                            {fact.value}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </div>
            </div>
          }
        />

        {draft.messages.length > 0 && (
          <details open={focus} className="rounded-md border border-paper-line-strong bg-paper/40 px-3 py-2">
            <summary className="cursor-pointer text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
              Conversa ({draft.messages.length} últimas mensagens)
            </summary>
            <ul className="mt-2 flex flex-col gap-1">
              {draft.messages.map((message, index) => (
                <li key={`${message.sentAt}-${index}`} className="text-[13px]">
                  <span className="text-ink-soft">
                    {message.direction === "inbound" ? "Família" : "Clínica"} ·{" "}
                    {fmtDateTime(message.sentAt, CLINIC_TIMEZONE)}:
                  </span>{" "}
                  <span className="text-ink">{message.body || (message.hasMedia ? "(arquivo enviado)" : "—")}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {(draft.warnings.length > 0 || draft.error) && (
          <ul className="flex flex-col gap-1 text-[13px] text-status-negative-text">
            {draft.error && <li>Leitura automática falhou: {draft.error}</li>}
            {draft.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}

        <DocumentRequestButtons
          draftId={draft.id}
          patientName={draft.patientName}
          hasPhone={Boolean(draft.sourcePhone)}
          requests={draft.documentRequests}
          missingKeys={missingChaseKeys(draft.pendencies)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <DraftAdjustButton draftId={draft.id} />
          {draft.status !== "validated" && !hideReviewLink && (
            <Link
              href={`/recepcao/pre-cadastros/${draft.id}`}
              className="btn btn-primary no-underline"
            >
              Conferir e cadastrar →
            </Link>
          )}
          {draft.patientId && draft.patientStatus !== "interessado" && (
            <Link href={`/recepcao/pacientes/${draft.patientId}`} className="text-[13px] no-underline text-ink-soft">
              Abrir prontuário
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
