// lib/document-categories.ts
/**
 * Categorias fixas de `documents.category` (CHECK constraint no banco,
 * PRD §7/§9.5) — lista única compartilhada entre o formulário de upload e a
 * listagem, pra nunca divergir entre as duas pontas.
 */
export const DOCUMENT_CATEGORIES = [
  { value: "pedido_medico", label: "Pedido médico" },
  { value: "laudo", label: "Laudo" },
  { value: "carteirinha", label: "Carteirinha" },
  { value: "termo", label: "Termo" },
  { value: "relatorio_evolucao", label: "Relatório de evolução" },
  { value: "reavaliacao", label: "Reavaliação" },
  { value: "autorizacao", label: "Autorização" },
  { value: "outro", label: "Outro" },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["value"];

export const DOCUMENT_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  DOCUMENT_CATEGORIES.map((c) => [c.value, c.label]),
);

type ValidityBadge = {
  label: string;
  soft: string;
  text: string;
};

/**
 * Destaque visual de vencido/vencendo — UI pura sobre `valid_until`, sem
 * job de alerta automático (fora de escopo desta entrega, PRD §9.5 é
 * Fase 1/2 pra isso). Reusa os tokens de status de DESIGN.md, mesmo padrão
 * de `components/measurement-card.tsx`.
 */
export function getValidityBadge(validUntil: string | null): ValidityBadge | null {
  if (!validUntil) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${validUntil}T00:00:00`);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return { label: "Vencido", soft: "bg-status-negative-soft", text: "text-status-negative-text" };
  }
  if (diffDays <= 15) {
    return { label: "Vence em breve", soft: "bg-status-pending-soft", text: "text-status-pending-text" };
  }
  return null;
}
