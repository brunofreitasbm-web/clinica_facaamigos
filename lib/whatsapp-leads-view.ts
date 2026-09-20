// lib/whatsapp-leads-view.ts
//
// Lógica pura (sem imports "@/") do painel "Leads via WhatsApp" da
// Supervisão: máscara de CPF, link wa.me, tipo do arquivo, selo de
// completude, rótulos de status e leitura defensiva do JSON extraído pela IA
// em `registration_drafts.extracted`. Fica separada do componente para ser
// testável com node:test (tests/whatsapp-leads-view.test.ts).

/** "12345678901" / "123.456.789-01" -> "***.456.789-**" (nunca mostra o CPF inteiro). */
export function maskCpf(cpf: string | null | undefined): string | null {
  const digits = (cpf ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return digits.length > 0 ? "***" : null;
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/**
 * Só dígitos do telefone com DDI (E.164 sem o "+"), ou null se inutilizável.
 * Número brasileiro sem DDI (10 ou 11 dígitos, como aparece em cadastros
 * antigos) ganha o "55" — sem ele o wa.me não abre a conversa certa.
 */
export function phoneDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  // Com "+" o DDI já veio explícito (pode ser número estrangeiro de 11 dígitos).
  if (!(phone ?? "").trim().startsWith("+") && (digits.length === 10 || digits.length === 11)) return `55${digits}`;
  return digits.length >= 10 ? digits : null;
}

/** Link de conversa direta no WhatsApp; null se o telefone for inutilizável. */
export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = phoneDigits(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

/** "+5591900000202" -> "+55 (91) 90000-0202". Formatos desconhecidos voltam como vieram. */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const raw = (phone ?? "").trim();
  if (!raw) return "—";
  const digits = phoneDigits(raw) ?? raw.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const split = rest.length === 9 ? 5 : 4;
    return `+55 (${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
  }
  return raw;
}

export type FileKind = "PDF" | "Foto" | "Arquivo";

/** Tipo amigável do arquivo a partir do mime_type (ou da extensão do nome). */
export function fileKind(mimeType: string | null | undefined, name?: string | null): FileKind {
  const mime = (mimeType ?? "").toLowerCase();
  const ext = (name ?? "").toLowerCase().split(".").pop() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "PDF";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) return "Foto";
  return "Arquivo";
}

export type CompletenessInput = {
  birthDate: string | null;
  guardianName: string | null;
  guardianCpf: string | null;
  guardianEmail: string | null;
  hasInsurance: boolean;
  /** true quando o atendimento é particular: convênio/cartão não é exigido. */
  isPrivate: boolean;
  cardNumber: string | null;
};

export type Completeness = { complete: boolean; missing: string[]; label: string };

const filled = (v: string | null | undefined) => (v ?? "").trim().length > 0;

/** Campos-chave do lead que ainda faltam; `label` já pronto para o selo. */
export function computeCompleteness(input: CompletenessInput): Completeness {
  const missing: string[] = [];
  if (!filled(input.birthDate)) missing.push("nascimento");
  if (!filled(input.guardianName)) missing.push("responsável");
  if (!filled(input.guardianCpf)) missing.push("CPF");
  if (!filled(input.guardianEmail)) missing.push("e-mail");
  if (!input.isPrivate && (!input.hasInsurance || !filled(input.cardNumber))) missing.push("convênio/cartão");
  return missing.length === 0
    ? { complete: true, missing, label: "Dados completos" }
    : { complete: false, missing, label: `Faltam: ${missing.join(", ")}` };
}

/** Status de anamnesis_scheduling_requests.status. */
export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pendente_supervisor: "Documentos para validar",
  aprovado: "Aprovado — aguardando horário",
  rejeitado: "Rejeitado",
  agendado: "Avaliação agendada",
  cancelado: "Cancelado",
};

/** Tag de cor (classes do design system existente, ver acolhimentos-panel). */
export const REQUEST_STATUS_TAG: Record<string, string> = {
  pendente_supervisor: "st-falta",
  aprovado: "st-confirmada",
  rejeitado: "st-falta",
  agendado: "st-realizada",
  cancelado: "st-cancelada",
};

export function requestStatusLabel(status: string | null | undefined): string {
  if (!status) return "Sem solicitação de agendamento";
  return REQUEST_STATUS_LABEL[status] ?? status;
}

/** registration_drafts.status. */
export const DRAFT_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando leitura",
  processing: "Lendo documento com IA…",
  extracted: "Pronto para conferir",
  failed: "Falhou",
};

export const DRAFT_STATUS_TAG: Record<string, string> = {
  pending: "st-agendada",
  processing: "st-agendada",
  extracted: "st-confirmada",
  failed: "st-falta",
};

export function draftStatusLabel(status: string | null | undefined): string {
  return DRAFT_STATUS_LABEL[status ?? ""] ?? status ?? "—";
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const asText = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export type DraftExtractionSummary = {
  childName: string | null;
  birthDate: string | null;
  cid: string | null;
  guardianName: string | null;
  guardianCpf: string | null;
  guardianEmail: string | null;
  insurerName: string | null;
  cardNumber: string | null;
};

/** Lê `registration_drafts.extracted` (DocumentExtraction) sem confiar no formato. */
export function summarizeDraftExtraction(extracted: unknown): DraftExtractionSummary {
  const root = asRecord(extracted);
  const patient = asRecord(root?.patient);
  const guardian = asRecord(root?.guardian);
  const insurance = asRecord(root?.insurance);
  return {
    childName: asText(patient?.full_name),
    birthDate: asText(patient?.birth_date),
    cid: asText(patient?.cid),
    guardianName: asText(guardian?.full_name),
    guardianCpf: asText(guardian?.cpf),
    guardianEmail: asText(guardian?.email),
    insurerName: asText(insurance?.insurer_name),
    cardNumber: asText(insurance?.card_number),
  };
}

/** Quando o lead "chegou": first_contact_at se existir, senão created_at. */
export function arrivalIso(firstContactAt: string | null | undefined, createdAt: string | null | undefined): string | null {
  return firstContactAt || createdAt || null;
}
