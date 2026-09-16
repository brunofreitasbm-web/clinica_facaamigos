"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, Pencil } from "lucide-react";
import { registerLeadAsInteressado, updateConversationContactName } from "./actions";
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    fullName: "",
    birthDate: "",
    guardianName: conversation.contactName ?? "",
    guardianRelationship: "Mãe",
    origin: "WhatsApp",
    chiefComplaint: "",
  });
  const setField = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

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
            <p className="text-xs font-semibold text-ink">Cadastrar interessado</p>
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
            <button
              type="button"
              className="btn btn-primary w-full justify-center text-sm"
              onClick={() => setShowForm(true)}
            >
              Cadastrar interessado
            </button>
            <Link href="/recepcao/pre-cadastros" className="btn btn-secondary w-full justify-center text-sm">
              Abrir cadastro assistido
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
