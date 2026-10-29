// lib/pre-anamnesis-questions.ts
// Perguntas da pré-anamnese por WhatsApp (lib/twilio-preanamnesis-bot.ts) e a
// leitura das respostas para as telas de 1ª avaliação. PURO, sem import com
// alias `@/`, para rodar em `node --test --experimental-strip-types`
// (tests/pre-anamnesis-questions.test.ts).
//
// Deliberadamente curto e sem perguntas que exijam julgamento clínico: o
// objetivo é coletar dado bruto para o terapeuta revisar e aprofundar na
// consulta, não substituir a anamnese oficial (`anamneses`).

export const PRE_ANAMNESIS_QUESTIONS: { key: string; label: string; prompt: string }[] = [
  {
    key: "queixa_principal",
    label: "Queixa principal",
    prompt: "Qual é a principal queixa ou motivo que trouxe vocês à avaliação?",
  },
  {
    key: "historico_gestacao_desenvolvimento",
    label: "Gestação, parto e desenvolvimento",
    prompt:
      "Há alguma informação sobre gestação, parto ou desenvolvimento (motor, fala, marcos) que considere importante?",
  },
  {
    key: "diagnosticos_medicamentos",
    label: "Diagnóstico e medicação",
    prompt: "A criança possui algum diagnóstico médico e/ou faz uso de medicação? Se sim, quais?",
  },
  {
    key: "alergias",
    label: "Alergias",
    prompt: "Há alergias alimentares ou a medicamentos que devemos saber?",
  },
  {
    key: "expectativas",
    label: "Expectativas para o 1º atendimento",
    prompt: "Por fim, o que vocês esperam desse primeiro atendimento?",
  },
];

/** Ids dos botões do template de convite (chegam ao webhook como `ButtonPayload`). */
export const PREANAM_BUTTON_YES = "preanam_yes";
export const PREANAM_BUTTON_NO = "preanam_no";

/** Colunas de `anamnesis_prefill_requests` que a tela usa. */
export type PrefillRow = {
  status: string;
  structured: unknown;
  sent_at: string | null;
  responded_at: string | null;
  declined_at: string | null;
};

export type PrefillView =
  | { kind: "answered"; respondedAt: string | null; items: { label: string; value: string }[] }
  | { kind: "waiting"; sentAt: string | null; reminded: boolean }
  | { kind: "declined"; declinedAt: string | null };

/**
 * Converte a linha do banco no que a tela mostra. Respostas saem na ordem das
 * perguntas, sem as vazias; `respondido` sem nenhuma resposta legível não vira
 * cartão de respostas (cairia num cartão vazio).
 */
export function buildPrefillView(row: PrefillRow | null | undefined): PrefillView | null {
  if (!row) return null;

  if (row.status === "respondido") {
    const answers = row.structured && typeof row.structured === "object" ? (row.structured as Record<string, unknown>) : {};
    const items = PRE_ANAMNESIS_QUESTIONS.flatMap((q) => {
      const value = answers[q.key];
      return typeof value === "string" && value.trim() ? [{ label: q.label, value: value.trim() }] : [];
    });
    return items.length > 0 ? { kind: "answered", respondedAt: row.responded_at, items } : null;
  }

  if (row.status === "recusado") return { kind: "declined", declinedAt: row.declined_at };
  if (row.status === "enviado" || row.status === "lembrete_enviado") {
    return { kind: "waiting", sentAt: row.sent_at, reminded: row.status === "lembrete_enviado" };
  }
  return null;
}
