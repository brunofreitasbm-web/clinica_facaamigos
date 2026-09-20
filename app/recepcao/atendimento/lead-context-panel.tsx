"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Check, Copy, FileText, ImageIcon, Paperclip, Pencil, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { registerLeadAsInteressado, updateConversationContactName, extractLeadInfoFromChat, type LeadDraftInfo } from "./actions";
import { formatConversationPhone } from "./format-phone";
import { ConversationNote } from "./conversation-note";
import type { ConversationPatch, ConversationRow } from "./atendimento-shell";

const ESCALATION_LABELS: Record<string, string> = {
  fora_da_base: "A dúvida não está na base de conhecimento do bot.",
  clinico: "Pergunta clínica sobre a criança — o bot não responde.",
  pediu_humano: "A pessoa pediu para falar com alguém da equipe.",
  relatorio: "Pedido de relatório/documento — dados coletados na última mensagem do bot, veja a conversa.",
};

const ORIGINS = ["WhatsApp", "Instagram", "Google", "Indicação", "Plano de Saúde", "Outro"];

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

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(conversation.contactName ?? "");
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionDone, setExtractionDone] = useState(false);
  const [draft, setDraft] = useState<LeadDraftInfo | null>(null);
  // Só afirmamos "preenchido via IA" quando algo realmente foi preenchido —
  // antes a mensagem aparecia mesmo com o formulário inteiro em branco.
  const [filledByAi, setFilledByAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [form, setForm] = useState({
    fullName: "",
    birthDate: "",
    guardianName: conversation.contactName ?? "",
    guardianEmail: "",
    guardianRelationship: "Mãe",
    origin: "WhatsApp",
    chiefComplaint: "",
  });
  const setField = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  // `conversation.contactName` muda quando a recepção renomeia o contato.
  // Lido por ref para que isso NÃO entre nas dependências de
  // handleExtractFromChat — senão renomear dispara uma extração nova (e paga).
  const contactNameRef = useRef(conversation.contactName);
  useEffect(() => {
    contactNameRef.current = conversation.contactName;
  }, [conversation.contactName]);

  const handleExtractFromChat = useCallback(async () => {
    setIsExtracting(true);
    setExtractionDone(false);
    try {
      const res = await extractLeadInfoFromChat(conversation.id);
      if (res.success) {
        setDraft(res.draft ?? null);
      }
      if (res.success && res.data) {
        setForm({
          fullName: res.data.fullName || "",
          birthDate: res.data.birthDate || "",
          guardianName: res.data.guardianName || contactNameRef.current || "",
          guardianEmail: res.data.guardianEmail || "",
          guardianRelationship: res.data.guardianRelationship || "Mãe",
          origin: res.data.origin || "WhatsApp",
          chiefComplaint: res.data.chiefComplaint || "",
        });
        setFilledByAi(Boolean(res.data.fullName || res.data.birthDate || res.data.chiefComplaint));
        setExtractionDone(true);
      }
    } catch (err) {
      console.error("Erro na extração dos dados do chat:", err);
    } finally {
      setIsExtracting(false);
    }
  }, [conversation.id]);

  // Pré-extrai automaticamente ao abrir a conversa — uma vez por conversa.
  // A extração chama a IA e, quando o pré-cadastro ainda está `pending`, roda
  // a leitura dos anexos no servidor: repetir isso a cada re-render custaria
  // dinheiro e tempo. O `queueMicrotask` mantém o corpo do efeito livre de
  // setState síncrono (react-hooks/set-state-in-effect).
  const autoExtractedFor = useRef<string | null>(null);
  useEffect(() => {
    if (autoExtractedFor.current === conversation.id) return;
    autoExtractedFor.current = conversation.id;
    queueMicrotask(() => {
      void handleExtractFromChat();
    });
  }, [conversation.id, handleExtractFromChat]);

  const handleOpenForm = () => {
    setShowForm(true);
    if (!extractionDone && !isExtracting) {
      handleExtractFromChat();
    }
  };

  const saveName = () => {
    const name = nameDraft.trim();
    setEditingName(false);
    onPatch({ contactName: name || null, displayName: name || phone });
    startTransition(async () => {
      const result = await updateConversationContactName(conversation.id, name);
      if (!result.success) setError(result.error);
    });
    if (!form.guardianName) setField("guardianName")(name);
  };

  const submitInteressado = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerLeadAsInteressado(conversation.id, { ...form, guardianPhone: phone });
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.warning) toast(result.warning, "info");
      else if (result.documentsTransferred > 0) {
        toast(`${result.documentsTransferred} arquivo(s) da conversa anexado(s) ao prontuário.`, "success");
      }
      // O painel troca sozinho para o de paciente assim que patientId chega.
      onPatch({
        patientId: result.patientId,
        guardianId: result.guardianId,
        kind: "patient",
        displayName: result.patientName,
        guardianName: result.guardianName,
      });
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

        {showForm ? (
          <form onSubmit={submitInteressado} className="flex flex-col gap-2 rounded-md border border-paper-line-strong p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink">Cadastrar interessado</p>
              <button
                type="button"
                disabled={isExtracting}
                onClick={handleExtractFromChat}
                className="flex items-center gap-1 text-[11px] text-accent hover:underline disabled:opacity-50"
                title="Extrair novamente do chat"
              >
                {isExtracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>{isExtracting ? "Analisando..." : "Reextrair IA"}</span>
              </button>
            </div>

            {isExtracting && (
              <div className="flex items-center gap-1.5 rounded bg-indigo-50 p-2 text-[11px] text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                <Loader2 size={13} className="animate-spin shrink-0" />
                <span>Analisando mensagens do chat com IA...</span>
              </div>
            )}

            {!isExtracting && extractionDone && filledByAi && (
              <div className="flex items-center gap-1.5 rounded bg-teal-50 p-2 text-[11px] text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
                <Sparkles size={13} className="shrink-0 text-teal-600 dark:text-teal-400" />
                <span>Campos preenchidos via IA a partir do chat e dos anexos</span>
              </div>
            )}

            {!isExtracting && extractionDone && !filledByAi && (
              <div className="flex items-center gap-1.5 rounded bg-amber-50 p-2 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <Sparkles size={13} className="shrink-0" />
                <span>
                  A IA não encontrou nome nem data de nascimento
                  {draft && draft.files.length > 0 ? " — confira os anexos abaixo e preencha à mão." : " na conversa."}
                </span>
              </div>
            )}

            <DraftAttachments draft={draft} />

            <input
              required
              className="input text-sm"
              placeholder="Nome da criança *"
              value={form.fullName}
              onChange={(e) => setField("fullName")(e.target.value)}
            />
            <label className="text-[11px] text-ink-faint">
              Data de nascimento *
              <input
                required
                type="date"
                className="input mt-0.5 w-full text-sm"
                value={form.birthDate}
                onChange={(e) => setField("birthDate")(e.target.value)}
              />
            </label>
            <input
              required
              className="input text-sm"
              placeholder="Nome do responsável *"
              value={form.guardianName}
              onChange={(e) => setField("guardianName")(e.target.value)}
            />
            <input
              type="email"
              className="input text-sm"
              placeholder="E-mail do responsável"
              value={form.guardianEmail}
              onChange={(e) => setField("guardianEmail")(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="input text-sm"
                value={form.guardianRelationship}
                onChange={(e) => setField("guardianRelationship")(e.target.value)}
              >
                {["Mãe", "Pai", "Avó/Avô", "Tio(a)", "Responsável"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <select className="input text-sm" value={form.origin} onChange={(e) => setField("origin")(e.target.value)}>
                {ORIGINS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <textarea
              rows={2}
              className="input text-sm"
              placeholder="Queixa / motivo da procura"
              value={form.chiefComplaint}
              onChange={(e) => setField("chiefComplaint")(e.target.value)}
            />
            <p className="text-[11px] text-ink-faint">Telefone do responsável: {phone}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost text-xs" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
                {isPending ? "Salvando…" : "Cadastrar e vincular"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-2">
            <DraftAttachments draft={draft} />
            <button
              type="button"
              className="btn btn-primary w-full justify-center text-sm"
              onClick={handleOpenForm}
            >
              Cadastrar interessado
            </button>
            <Link href="/recepcao/pacientes/pendencias" className="btn btn-secondary w-full justify-center text-sm">
              Ver documentos recebidos
            </Link>
            <p className="text-xs text-ink-faint">
              O cadastro rápido vincula esta conversa ao paciente na hora, com o histórico já trocado.
            </p>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">⚠️ {error}</p>}
      </div>

      <ConversationNote conversationId={conversation.id} />
    </div>
  );
}
