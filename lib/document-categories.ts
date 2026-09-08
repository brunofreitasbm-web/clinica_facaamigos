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
  // Módulo 3 MAAIS, slide 4 (fluxo Acolhimento) e slide 19 (kit de
  // boas-vindas) — supabase/migrations/20260906000006_intake_documents.sql.
  { value: "contrato", label: "Contrato" },
  { value: "termo_lgpd", label: "Termo LGPD" },
  { value: "termo_imagem", label: "Termo de uso de imagem" },
  { value: "documento_responsavel", label: "Documento do responsável" },
  { value: "kit_boas_vindas", label: "Kit de boas-vindas" },
  { value: "carta_terapeuta", label: "Carta ao terapeuta" },
  { value: "manual_clinica", label: "Manual da clínica" },
  // Envio pela família via portal (PRD §9.7/§3.6,
  // 20260906000020_family_document_upload.sql) — nunca aparece no seletor de
  // upload da recepção (DOCUMENT_CATEGORIES é usado lá só como fonte de
  // labels aqui), só é atribuída pelo próprio insert do responsável.
  { value: "familia_envio", label: "Enviado pela família" },
  // Cadastro assistido por IA (20260907000001_registration_drafts.sql) —
  // documentos de identificação da criança/responsável extraídos por
  // WhatsApp/portal e categorizados pela recepção na tela de validação.
  { value: "certidao_nascimento", label: "Certidão de nascimento" },
  { value: "documento_identidade", label: "Documento de identidade (RG/CPF)" },
  { value: "comprovante_residencia", label: "Comprovante de residência" },
  // PDF consolidado gerado pela Supervisão no Prontuário Unificado
  // (20260908210000_family_share_document_category.sql) — sempre
  // shared_with_family=true, nunca aparece no seletor de upload da recepção.
  { value: "compartilhamento_familia", label: "Compartilhamento com a família" },
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
