"use client";

import Link from "next/link";
import { formatConversationPhone } from "./format-phone";
import type { ConversationRow } from "./atendimento-shell";

const ESCALATION_LABELS: Record<string, string> = {
  fora_da_base: "A dúvida não está na base de conhecimento do bot.",
  clinico: "Pergunta clínica sobre a criança — o bot não responde.",
  pediu_humano: "A pessoa pediu para falar com alguém da equipe.",
};

/**
 * Painel lateral para conversas sem paciente vinculado. O painel normal
 * (PatientContextPanel) mostra convênio e próximos atendimentos, que não
 * existem para quem ainda não é paciente — aqui o que importa é converter o
 * contato em cadastro.
 */
export function LeadContextPanel({ conversation }: { conversation: ConversationRow }) {
  const escalationLabel = conversation.escalationReason
    ? ESCALATION_LABELS[conversation.escalationReason]
    : null;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      <div>
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
          Contato
        </h6>
        <p className="text-sm font-semibold">{conversation.displayName}</p>
        <p className="text-sm text-ink-soft">{formatConversationPhone(conversation.phoneNumber)}</p>
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
        <Link href="/recepcao/pre-cadastros" className="btn btn-secondary w-full justify-center text-sm">
          Abrir cadastro assistido
        </Link>
        <p className="mt-2 text-xs text-ink-faint">
          Ao cadastrar o responsável com este telefone, a conversa passa a ficar vinculada ao paciente
          automaticamente.
        </p>
      </div>
    </div>
  );
}
