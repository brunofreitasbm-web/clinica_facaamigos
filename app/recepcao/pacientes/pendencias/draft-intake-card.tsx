import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import type { PendingRegistrationDraft } from "@/lib/reception-queue";
import { DocumentRequestButtons } from "./document-request-buttons";
import { DraftPipelineColumns } from "./draft-pipeline";

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

export function DraftIntakeCard({ draft }: { draft: PendingRegistrationDraft }) {
  return (
    // Quem recolhe/expande é a linha do contato (CollapsibleQueueRow, em
    // page.tsx): com vários contatos na fila ao mesmo tempo, o cartão aberto
    // empurrava as outras pendências para fora da tela.
    <div className="mt-3 border-t border-paper-line-strong pt-3 text-sm">
      <div className="flex flex-col gap-3">
        {draft.guardianMessage && (
          <p className="rounded-md bg-paper-line/40 px-3 py-2 text-ink">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Mensagem da família: </span>
            {draft.guardianMessage}
          </p>
        )}

        {/* Linha do tempo: documentos → autorização do plano → habilitado para
            agendamento. A coluna 1 é o que antes era o cartão inteiro. */}
        <DraftPipelineColumns
          draft={draft}
          documents={
            <div className="flex flex-col gap-3">
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Arquivos recebidos ({draft.files.length})
                </h4>
                {draft.files.length === 0 ? (
                  <p className="m-0 text-ink-faint">Nenhum arquivo anexado a este contato.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {draft.files.map((file) => (
                      <li key={file.id}>
                        <a
                          href={`/api/arquivos/rascunho/${file.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[13px] font-medium no-underline"
                          style={{ color: "var(--color-accent)" }}
                        >
                          {fileLabel(file)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Dados já recebidos ({draft.facts.length})
                </h4>
                {draft.facts.length === 0 ? (
                  <p className="m-0 text-ink-faint">
                    Nada lido automaticamente ainda — abra os arquivos acima e a conversa abaixo para conferir.
                  </p>
                ) : (
                  <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {draft.facts.map((fact) => (
                      <div key={fact.label} className="contents">
                        <dt className="text-xs uppercase tracking-wide text-ink-soft">{fact.label}</dt>
                        <dd className="m-0 text-ink">{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          }
        />

        {draft.messages.length > 0 && (
          <details className="rounded-md border border-paper-line-strong bg-paper/40 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-soft">
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
        />

        <div className="flex flex-wrap items-center gap-3">
          {draft.status !== "validated" && (
            <Link
              href={`/recepcao/pre-cadastros/${draft.id}`}
              className="text-[13px] font-semibold no-underline"
              style={{ color: "var(--color-accent)" }}
            >
              Conferir e cadastrar →
            </Link>
          )}
          {draft.patientId && (
            <Link href={`/recepcao/pacientes/${draft.patientId}`} className="text-[13px] no-underline text-ink-soft">
              Abrir prontuário
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
