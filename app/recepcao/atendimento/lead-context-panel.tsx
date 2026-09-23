"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Check, Copy, FileText, ImageIcon, Paperclip, Pencil, Sparkles, Loader2 } from "lucide-react";
import { openLeadPendency, getLeadDraftByConversationId, updateConversationContactName, extractLeadInfoFromChat, type LeadDraftInfo } from "./actions";
import { formatConversationPhone } from "./format-phone";
import { ConversationNote } from "./conversation-note";
import type { ConversationPatch, ConversationRow } from "./atendimento-shell";
import { LeadFocusDialog } from "../pacientes/pendencias/lead-focus-dialog";
import { DraftIntakeCard } from "../pacientes/pendencias/draft-intake-card";
import type { PendingRegistrationDraft } from "@/lib/reception-queue";

const ESCALATION_LABELS: Record<string, string> = {
  fora_da_base: "A dúvida não está na base de conhecimento do bot.",
  clinico: "Pergunta clínica sobre a criança — o bot não responde.",
  pediu_humano: "A pessoa pediu para falar com alguém da equipe.",
  relatorio: "Pedido de relatório/documento — dados coletados na última mensagem do bot, veja a conversa.",
};

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
  const phone = formatConversationPhone(conversation.phoneNumber);
  const escalationLabel = conversation.escalationReason
    ? ESCALATION_LABELS[conversation.escalationReason]
    : null;

  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(conversation.contactName ?? "");
  const [copied, setCopied] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionDone, setExtractionDone] = useState(false);
  const [draft, setDraft] = useState<LeadDraftInfo | null>(null);
  // Só afirmamos "dados lidos" quando algo realmente foi extraído — antes a
  // mensagem aparecia mesmo com a conversa inteira em branco.
  const [filledByAi, setFilledByAi] = useState(false);
  // Currículo/vaga de emprego: o bot já resolveu sozinho, sem IA — nada aqui
  // é lead de matrícula (ver hasStrongJobSignal em actions.ts). Evita mostrar
  // "Analisando..." por um assunto que nunca vai virar dado de cadastro.
  const [notApplicable, setNotApplicable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [focusDraft, setFocusDraft] = useState<PendingRegistrationDraft | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleExtractFromChat = useCallback(async () => {
    setIsExtracting(true);
    setExtractionDone(false);
    try {
      const res = await extractLeadInfoFromChat(conversation.id);
      if (res.success) {
        if (res.notApplicable) {
          setNotApplicable(true);
          return;
        }
        setDraft(res.draft ?? null);
        setFilledByAi(Boolean(res.data?.fullName || res.data?.birthDate || res.data?.chiefComplaint));
        setExtractionDone(true);
      }
    } catch (err) {
      console.error("Erro na extração dos dados do chat:", err);
    } finally {
      setIsExtracting(false);
    }
  }, [conversation.id]);

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
    onPatch({ contactName: name || null, displayName: name || phone });
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
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
          Contato
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
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(phone).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
          title="Copiar telefone"
        >
          {phone}
          {copied ? <Check size={12} className="text-status-active" /> : <Copy size={12} className="opacity-60" />}
        </button>
        <p className="mt-2 text-xs text-ink-faint">
          Ainda não é paciente: este número não está vinculado a nenhum responsável cadastrado.
        </p>
      </div>

      {escalationLabel && (
        <div
          className="rounded-md p-3 text-xs"
          style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
        >
          <div className="mb-1 font-semibold">Bot escalou para a equipe</div>
          {escalationLabel}
        </div>
      )}

      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
          Próximo passo
        </h6>

        <div className="flex flex-col gap-2">
          {isExtracting && !notApplicable && (
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

          {!isExtracting && !notApplicable && extractionDone && filledByAi && (
            <div className="flex items-center gap-1.5 rounded bg-teal-50 p-2 text-[11px] text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
              <Sparkles size={13} className="shrink-0 text-teal-600 dark:text-teal-400" />
              <span>Dados lidos e guardados na pendência deste contato</span>
            </div>
          )}

          <DraftAttachments draft={draft} />

          <button
            type="button"
            disabled={isPending}
            className="btn btn-primary w-full justify-center gap-1.5 text-sm"
            onClick={handleResolverPendencias}
          >
            <ClipboardList size={14} />
            {isPending ? "Abrindo…" : "Resolver pendências"}
          </button>
          <p className="text-xs text-ink-faint">
            Abre a fila de pendências já focada neste contato — dados, documentos e o que falta antes do cadastro.
          </p>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">⚠️ {error}</p>}
      </div>

      <ConversationNote conversationId={conversation.id} />

      {isModalOpen && (
        <LeadFocusDialog draft={focusDraft} onClose={() => setIsModalOpen(false)}>
          {focusDraft && <DraftIntakeCard draft={focusDraft} focus />}
        </LeadFocusDialog>
      )}
    </div>
  );
}
