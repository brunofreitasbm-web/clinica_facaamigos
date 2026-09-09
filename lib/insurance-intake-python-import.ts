// lib/insurance-intake-python-import.ts
// Caminho complementar ao de lib/insurance-intake-extraction.ts: converte o
// JSON gerado offline por scripts/extract_convenio_patients.py (parser em
// tabela via pdfplumber — mais preciso que o texto linearizado que o
// unpdf/Gemini recebem para layouts como "CONTROLE PORTO TERAPIAS"/NAU
// Unimed, com células de terapias quebradas em várias linhas) para o mesmo
// shape `IntakeExtraction` usado pelo restante do pipeline. Não substitui a
// extração via IA — é uma via alternativa para quando o supervisor já rodou
// o script localmente e tem o JSON pronto.
import type { IntakeExtraction, IntakeRow } from "@/lib/insurance-intake-extraction";

export type PythonIntakeRecord = {
  source_file: string;
  seq: string;
  therapies: string[];
  client_name: string;
  birth_date: string | null;
  age: string | null;
  phone: string | null;
  guia: string;
  senha: string;
  card_code: string;
  shift: string | null;
};

function coerceString(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return null;
}

/** Parse defensivo do JSON enviado — nunca confia no shape do arquivo (mesmo critério de lib/insurance-intake-profile.ts). */
export function parsePythonIntakeRecords(raw: unknown): PythonIntakeRecord[] {
  if (!Array.isArray(raw)) return [];
  const records: PythonIntakeRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const clientName = coerceString(r.client_name);
    if (!clientName) continue;
    records.push({
      source_file: coerceString(r.source_file) ?? "",
      seq: coerceString(r.seq) ?? "",
      therapies: Array.isArray(r.therapies) ? r.therapies.filter((t): t is string => typeof t === "string" && t.trim().length > 0) : [],
      client_name: clientName,
      birth_date: coerceString(r.birth_date),
      age: coerceString(r.age),
      phone: coerceString(r.phone),
      guia: coerceString(r.guia) ?? "",
      senha: coerceString(r.senha) ?? "",
      card_code: coerceString(r.card_code) ?? "",
      shift: coerceString(r.shift),
    });
  }
  return records;
}

function toIntakeRow(record: PythonIntakeRecord, insurerNameHint: string | null): IntakeRow {
  const warnings: string[] = [
    "Linha importada do script Python (extração em tabela) — sem responsável, sessões autorizadas ou vigência de guia neste layout; complete manualmente se necessário.",
  ];
  if (!record.birth_date) warnings.push("Data de nascimento não encontrada nesta linha.");
  if (!record.phone) warnings.push("Telefone não encontrado nesta linha.");

  return {
    patient_full_name: record.client_name,
    patient_birth_date: record.birth_date,
    patient_cpf: null,
    patient_sexo: null,
    patient_cid: null,
    guardian_full_name: null,
    guardian_cpf: null,
    guardian_relationship: null,
    guardian_email: null,
    guardian_phones: record.phone ? [record.phone] : [],
    card_number: record.card_code || null,
    plan_name: insurerNameHint,
    card_valid_until: null,
    guide_number: record.guia || null,
    procedure_code: record.therapies.join(", ") || null,
    sessions_authorized: null,
    valid_from: null,
    valid_to: null,
    authorization_password: record.senha || null,
    extra: {
      therapies_list: record.therapies.join("; ") || null,
      age: record.age,
      shift: record.shift,
      seq: record.seq || null,
      source_file: record.source_file || null,
    },
    confidence: {},
    warnings,
  };
}

export function mapPythonRecordsToIntakeExtraction(records: PythonIntakeRecord[], insurerNameHint: string | null = null): IntakeExtraction {
  return {
    detected_insurer_name: insurerNameHint,
    rows: records.map((r) => toIntakeRow(r, insurerNameHint)),
    warnings: ["Lote importado a partir do JSON gerado por scripts/extract_convenio_patients.py."],
    truncated: false,
  };
}
