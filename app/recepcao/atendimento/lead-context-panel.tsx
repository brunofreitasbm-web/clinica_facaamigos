"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Check, FileText, ImageIcon, Paperclip, Pencil, Loader2 } from "lucide-react";
import { getLeadDraftByConversationId, updateConversationContactName, extractLeadInfoFromChat, type LeadDraftInfo } from "./actions";
import { CaseSummary } from "./case-summary";
import { formatConversationPhone } from "./format-phone";
import { ConversationNote } from "./conversation-note";
import type { ConversationPatch, ConversationRow } from "./atendimento-shell";
import { LeadFocusDialog } from "../pacientes/pendencias/lead-focus-dialog";
import { DraftIntakeCard } from "../pacientes/pendencias/draft-intake-card";
import type { PendingRegistrationDraft } from "@/lib/reception-queue";
import { NotPatientButton } from "@/components/not-patient-button";

const DOCUMENT_KIND_LABEL: Record<string, string> = {
  laudo: "Laudo",
  guia: "Guia",
  carteirinha: "Carteirinha",
  rg: "RG",
  cpf: "CPF",
  certidao: "Certidão",
  comprovante_residencia: "Comprovante de residência",
  pedido_medico: "Pedido médico",
  outro: "Documento",
};

/**
 * Arquivos que a família já mandou por WhatsApp para este telefone. Ficavam
 * visíveis só em /recepcao/pre-cadastros — quem estava na conversa não tinha
 * como abri-los nem sabia que existiam.
 */
function DraftAttachments({ draft }: { draft: LeadDraftInfo | null }) {
  if (!draft || draft.files.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-paper-line-strong bg-paper-2 p-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
        <Paperclip size={12} className="shrink-0" aria-hidden />
        <span>
          {draft.files.length} {draft.files.length === 1 ? "documento recebido" : "documentos recebidos"} por WhatsApp
        </span>
      </div>

      {draft.files.map((file) => {
        const isImage = (file.mimeType ?? "").startsWith("image/");
        const label =
          (file.detectedType && DOCUMENT_KIND_LABEL[file.detectedType]) ||
          file.originalName ||
          (isImage ? "Foto" : "Documento");
        return (
          <a
            key={file.id}
            href={`/api/arquivos/rascunho/${file.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-accent underline underline-offset-2 hover:opacity-80"
          >
            {isImage ? <ImageIcon size={12} className="shrink-0" aria-hidden /> : <FileText size={12} className="shrink-0" aria-hidden />}
            <span className="truncate">{label}</span>
          </a>
        );
      })}

      {draft.awaitingExtraction && (
        <p className="text-[10px] text-ink-faint">
          A IA ainda não conseguiu ler estes arquivos — abra cada um para conferir os dados.
        </p>
      )}

      <Link href={`/recepcao/pre-cadastros/${draft.id}`} className="text-[11px] text-accent underline underline-offset-2">
        Abrir no cadastro assistido
      </Link>
    </div>
  );
}

/**
 * Painel lateral para conversas sem paciente vinculado. O painel normal
 * (PatientContextPanel) mostra convênio e próximos atendimentos, que não
 * existem para quem ainda não é paciente — aqui o que importa é converter o
 * contato em cadastro sem sair da conversa.
 */
export function LeadContextPanel({
  conversation,
  onPatch,
}: {
  conversation: ConversationRow;
  onPatch: (patch: ConversationPatch) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(conversation.contactName ?? "");
  const [isExtracting, setIsExtracting] = useState(false);
  const [draft, setDraft] = useState<LeadDraftInfo | null>(null);
  // Muda quando algo que altera o resumo do caso aconteceu (IA terminou de ler, pendências resolvidas).
  const [summaryRefresh, setSummaryRefresh] = useState(0);
  // Currículo/vaga de emprego: o bot já resolveu sozinho, sem IA — nada aqui
  // é lead de matrícula (ver hasStrongJobSignal em actions.ts). Evita mostrar
  // "Analisando..." por um assunto que nunca vai virar dado de cadastro.
  const [notApplicable, setNotApplicable] = useState(false);
  // Marcação manual "não é paciente" (null = tratado como lead).
  const [nonPatientReason, setNonPatientReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [focusDraft, setFocusDraft] = useState<PendingRegistrationDraft | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleExtractFromChat = useCallback(async () => {
    setIsExtracting(true);
    try {
      const res = await extractLeadInfoFromChat(conversation.id);
      if (res.success) {
        if (res.notApplicable === "nao_paciente") {
          setNonPatientReason(res.nonPatientReason ?? "marcado");
          onPatch({ nonPatient: true });
          return;
        }
        if (res.notApplicable) {
          setNotApplicable(true);
          return;
        }
        setDraft(res.draft ?? null);
        setSummaryRefresh((n) => n + 1);
      }
    } catch (err) {
      console.error("Erro na extração dos dados do chat:", err);
    } finally {
      setIsExtracting(false);
    }
  }, [conversation.id, onPatch]);

  // Pré-extrai automaticamente ao abrir a conversa — uma vez por conversa.
  // A extração chama a IA, lê a conversa e os documentos e grava o resultado
  // direto no rascunho da fila de pendências (registration_drafts.extracted,
  // ver app/recepcao/atendimento/actions.ts): repetir isso a cada re-render
  // custaria dinheiro e tempo. O `queueMicrotask` mantém o corpo do efeito
  // livre de setState síncrono (react-hooks/set-state-in-effect).
  const autoExtractedFor = useRef<string | null>(null);
  useEffect(() => {
    if (autoExtractedFor.current === conversation.id) return;
    autoExtractedFor.current = conversation.id;
    queueMicrotask(() => {
      void handleExtractFromChat();
    });
  }, [conversation.id, handleExtractFromChat]);

  const saveName = () => {
    const name = nameDraft.trim();
    setEditingName(false);
    onPatch({ contactName: name || null, displayName: name || formatConversationPhone(conversation.phoneNumber) });
    startTransition(async () => {
      const result = await updateConversationContactName(conversation.id, name);
      if (!result.success) setError(result.error);
    });
  };

  const handleResolverPendencias = () => {
    setError(null);
    setIsModalOpen(true);
    startTransition(async () => {
      const res = await getLeadDraftByConversationId(conversation.id);
      if (res.success && res.draft) {
        setFocusDraft(res.draft);
      } else {
        setError(res.error || "Não foi possível carregar as pendências.");
      }
    });
  };

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      <CaseSummary
        conversation={conversation}
        onResolvePendencies={handleResolverPendencias}
        resolving={isPending}
        refreshToken={summaryRefresh}
      />

      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
          Nome do contato
        </h6>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="input flex-1 text-sm"
              placeholder="Nome do contato"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditingName(false);
              }}
            />
            <button type="button" className="btn btn-primary btn-icon" onClick={saveName} aria-label="Salvar nome">
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="group flex items-center gap-1.5 text-left text-sm font-semibold"
            title="Editar nome do contato"
          >
            {conversation.contactName ?? <span className="text-ink-faint">Sem nome — adicionar</span>}
            <Pencil size={12} className="text-ink-faint opacity-60 group-hover:opacity-100" />
          </button>
        )}
      </div>

      {/* Dúvida, publicidade, fornecedor: tira de Autorizações/leads sem encerrar o chat. */}
      <div>
        <NotPatientButton
          phone={conversation.phoneNumber}
          markedReason={nonPatientReason}
          onChanged={(reason) => {
            setNonPatientReason(reason);
            onPatch({ nonPatient: reason !== null });
            setDraft(null);
            if (reason === null) {
              // Volta a ser lead: refaz a leitura da conversa e o resumo do caso.
              void handleExtractFromChat();
            }
            setSummaryRefresh((n) => n + 1);
          }}
        />
      </div>

      {isExtracting && !notApplicable && !nonPatientReason && (
        <div className="flex items-center gap-1.5 rounded bg-indigo-50 p-2 text-[11px] text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
          <Loader2 size={13} className="animate-spin shrink-0" />
          <span>Analisando conversa e documentos com IA...</span>
        </div>
      )}

      {notApplicable && (
        <p className="text-xs text-ink-faint">
          Assunto de currículo/vaga — o bot já respondeu, não é cadastro de paciente.
        </p>
      )}

      <DraftAttachments draft={draft} />

      {error && <p className="text-xs text-red-600">⚠️ {error}</p>}

      <ConversationNote conversationId={conversation.id} />

      {isModalOpen && (
        <LeadFocusDialog
          draft={focusDraft}
          onClose={() => {
            setIsModalOpen(false);
            setSummaryRefresh((n) => n + 1);
          }}
        >
          {focusDraft && <DraftIntakeCard draft={focusDraft} focus inChat />}
        </LeadFocusDialog>
      )}
    </div>
  );
}
