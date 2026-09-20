// lib/business-hours-pure.ts
// Formatação PURA da grade de `clinic_business_hours` (uma linha por dia da
// semana) em texto para humanos: é o que o chatbot do WhatsApp diz quando
// escala para a recepção ("nossa equipe responde de segunda a sexta, das 08h
// às 18h"). Sem import com alias `@/` para rodar em
// `node --test --experimental-strip-types` (tests/business-hours-pure.test.ts).

export type BusinessHourRow = {
  /** 0 = domingo (extract(dow) do Postgres). */
  day_of_week: number;
  /** `time` do Postgres: "08:00:00". */
  open_time: string;
  close_time: string;
};

const DAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "08:00:00" → "08h", "08:30:00" → "08h30". */
function formatTime(value: string): string {
  const [h = "00", m = "00"] = value.split(":");
  return m === "00" ? `${h}h` : `${h}h${m}`;
}

/**
 * Agrupa dias CONSECUTIVOS com o mesmo horário: seg–sex 08–18 + sáb 08–12
 * vira "segunda a sexta, das 08h às 18h; sábado, das 08h às 12h". Dias sem
 * linha na tabela simplesmente não aparecem (a clínica não atende).
 *
 * @returns texto pronto, ou string vazia se a grade não estiver cadastrada —
 *   aí quem chama decide o que dizer (nunca inventar um horário).
 */
export function formatBusinessHours(rows: BusinessHourRow[]): string {
  const sorted = [...rows]
    .filter((r) => r.day_of_week >= 0 && r.day_of_week <= 6)
    .sort((a, b) => a.day_of_week - b.day_of_week || a.open_time.localeCompare(b.open_time));
  if (sorted.length === 0) return "";

  const groups: { from: number; to: number; open: string; close: string }[] = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    const sameShift = last && last.open === row.open_time && last.close === row.close_time;
    // Só agrupa dias em sequência: seg+qua com o mesmo horário viram duas faixas.
    if (sameShift && last.to === row.day_of_week - 1) {
      last.to = row.day_of_week;
      continue;
    }
    groups.push({ from: row.day_of_week, to: row.day_of_week, open: row.open_time, close: row.close_time });
  }

  return groups
    .map((g) => {
      const days =
        g.from === g.to
          ? DAY_NAMES[g.from]
          : g.to === g.from + 1
            ? `${DAY_NAMES[g.from]} e ${DAY_NAMES[g.to]}`
            : `${DAY_NAMES[g.from]} a ${DAY_NAMES[g.to]}`;
      return `${days}, das ${formatTime(g.open)} às ${formatTime(g.close)}`;
    })
    .join("; ");
}
