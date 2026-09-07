// lib/insurance-intake-profile.ts
// Perfil de extração por convênio (`insurers.intake_extraction_profile`,
// supabase/migrations/20260907170006_insurance_intake.sql) — cada plano de
// saúde manda a relação de encaminhados num PDF com layout próprio; este
// shape guarda as dicas que o supervisor configura uma vez (em
// /gestor/convenios ou pela aba "Acolhimentos") pra ajudar o Gemini a ler
// aquele layout específico. Tudo opcional: sem perfil configurado, a
// extração ainda funciona (o prompt genérico dá conta da maioria dos
// layouts), só com menos precisão.

export type IntakeFieldKey =
  | "patient_full_name"
  | "patient_birth_date"
  | "patient_cpf"
  | "patient_sexo"
  | "patient_cid"
  | "guardian_full_name"
  | "guardian_cpf"
  | "guardian_relationship"
  | "guardian_email"
  | "guardian_phones"
  | "card_number"
  | "plan_name"
  | "card_valid_until"
  | "guide_number"
  | "procedure_code"
  | "sessions_authorized"
  | "valid_from"
  | "valid_to"
  | "authorization_password";

export const INTAKE_FIELD_LABEL: Record<IntakeFieldKey, string> = {
  patient_full_name: "Nome do paciente",
  patient_birth_date: "Data de nascimento",
  patient_cpf: "CPF do paciente",
  patient_sexo: "Sexo",
  patient_cid: "CID",
  guardian_full_name: "Nome do responsável",
  guardian_cpf: "CPF do responsável",
  guardian_relationship: "Parentesco",
  guardian_email: "E-mail do responsável",
  guardian_phones: "Telefone(s)",
  card_number: "Nº da carteirinha",
  plan_name: "Nome do plano",
  card_valid_until: "Validade da carteirinha",
  guide_number: "Nº da guia",
  procedure_code: "Código do procedimento",
  sessions_authorized: "Sessões autorizadas",
  valid_from: "Vigência — início",
  valid_to: "Vigência — fim",
  authorization_password: "Senha de autorização",
};

export type IntakeExtractionProfile = {
  version: 1;
  /** Texto livre descrevendo o layout ("tabela com uma linha por beneficiário; 2ª coluna é a carteirinha…"). */
  layout_hints?: string;
  /** Palavras/expressões que aparecem no cabeçalho deste convênio — ajuda a auto-detecção quando o supervisor não escolhe o convênio manualmente. */
  header_keywords?: string[];
  /** Mapeamento explícito "rótulo no PDF" → campo estruturado. */
  columns?: { key: IntakeFieldKey; label_in_pdf: string; example?: string; notes?: string }[];
  /** Formato de data predominante no PDF (ex.: "dd/mm/yyyy"), só documentação — o parser já tenta vários formatos. */
  date_format?: string;
  /** Observação sobre como os telefones aparecem (ex.: "sem DDD, sempre São Paulo"). */
  phone_notes?: string;
  /** DDD a assumir quando um telefone vier sem DDD. */
  default_ddd?: string;
  /** Campos extras específicos deste convênio, sem equivalente nas colunas fixas — vão para `insurance_intake_leads.extra`. */
  extra_fields?: { key: string; label: string }[];
  /** Código de procedimento padrão a usar quando o PDF não traz TUSS/AMB explícito. */
  procedure_code_default?: string;
};

export const EMPTY_INTAKE_PROFILE: IntakeExtractionProfile = { version: 1 };

/** Parse defensivo do jsonb vindo do banco — nunca confia no shape armazenado. */
export function parseIntakeProfile(raw: unknown): IntakeExtractionProfile {
  if (!raw || typeof raw !== "object") return { ...EMPTY_INTAKE_PROFILE };
  const r = raw as Record<string, unknown>;

  const columns = Array.isArray(r.columns)
    ? r.columns
        .map((c) => {
          const co = (c ?? {}) as Record<string, unknown>;
          const key = typeof co.key === "string" ? (co.key as IntakeFieldKey) : null;
          const label = typeof co.label_in_pdf === "string" ? co.label_in_pdf : "";
          if (!key || !(key in INTAKE_FIELD_LABEL) || !label) return null;
          return {
            key,
            label_in_pdf: label,
            example: typeof co.example === "string" ? co.example : undefined,
            notes: typeof co.notes === "string" ? co.notes : undefined,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
    : undefined;

  const extraFields = Array.isArray(r.extra_fields)
    ? r.extra_fields
        .map((f) => {
          const fo = (f ?? {}) as Record<string, unknown>;
          const key = typeof fo.key === "string" ? fo.key.trim() : "";
          const label = typeof fo.label === "string" ? fo.label.trim() : "";
          if (!key || !label) return null;
          return { key, label };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null)
    : undefined;

  return {
    version: 1,
    layout_hints: typeof r.layout_hints === "string" ? r.layout_hints : undefined,
    header_keywords: Array.isArray(r.header_keywords) ? r.header_keywords.filter((k): k is string => typeof k === "string") : undefined,
    columns: columns && columns.length > 0 ? columns : undefined,
    date_format: typeof r.date_format === "string" ? r.date_format : undefined,
    phone_notes: typeof r.phone_notes === "string" ? r.phone_notes : undefined,
    default_ddd: typeof r.default_ddd === "string" ? r.default_ddd.replace(/\D/g, "").slice(0, 2) || undefined : undefined,
    extra_fields: extraFields && extraFields.length > 0 ? extraFields : undefined,
    procedure_code_default: typeof r.procedure_code_default === "string" ? r.procedure_code_default : undefined,
  };
}
