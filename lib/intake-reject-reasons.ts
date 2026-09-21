/**
 * Motivos padronizados de rejeição de documentos (acolhimento e 1ª avaliação).
 * Fica fora dos arquivos "use server" porque os componentes de cliente também
 * precisam da lista, e arquivos "use server" só podem exportar funções async.
 */
export type IntakeRejectReasonCode = "ilegivel" | "incompleto" | "vencido" | "documento_errado" | "outro";

/** Frase que entra na mensagem de WhatsApp enviada ao responsável. */
export const REJECT_REASON_LABEL: Record<IntakeRejectReasonCode, string> = {
  ilegivel: "os documentos ficaram ilegíveis (imagem borrada ou muito escura)",
  incompleto: "faltou parte do documento (página ou verso)",
  vencido: "a carteirinha/guia enviada está vencida",
  documento_errado: "o documento enviado não corresponde ao que pedimos",
  outro: "precisamos que você reenvie os documentos",
};

export const REJECT_REASON_OPTIONS: { value: IntakeRejectReasonCode; label: string }[] = [
  { value: "ilegivel", label: "Ilegível" },
  { value: "incompleto", label: "Incompleto" },
  { value: "vencido", label: "Vencido" },
  { value: "documento_errado", label: "Documento errado" },
  { value: "outro", label: "Outro" },
];

export function isRejectReasonCode(value: string): value is IntakeRejectReasonCode {
  return value in REJECT_REASON_LABEL;
}
