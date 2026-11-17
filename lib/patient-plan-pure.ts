// lib/patient-plan-pure.ts
// Decide o que a pílula de convênio mostra para um paciente a partir das linhas de
// `patient_insurance`. PURO (sem alias `@/`) para rodar em node --test.
//
// Três estados:
//  - "plan": existe convênio identificado (insurer_id preenchido, não particular);
//  - "particular": o operador marcou "é particular" (is_private = true);
//  - "unknown": sem linha ou só linha sem convênio identificável. Aqui a tela
//    oferece a caixinha "É particular" em vez de assumir Particular sozinha.
// Convênio identificado ganha de Particular: não depende da ordem das linhas.

export type InsuranceRowForPlan = {
  is_private?: boolean | null;
  insurers?:
    | { name?: string | null; badge_color?: string | null }
    | { name?: string | null; badge_color?: string | null }[]
    | null;
};

export type PlanPill =
  | { kind: "plan"; name: string; color: string | null }
  | { kind: "particular"; name: "Particular"; color: string }
  | { kind: "unknown"; name: null; color: null };

export const PARTICULAR_COLOR = "#64748b";

function insurerOf(row: InsuranceRowForPlan) {
  return Array.isArray(row.insurers) ? (row.insurers[0] ?? null) : (row.insurers ?? null);
}

export function resolvePlanPill(rows: InsuranceRowForPlan[] | null | undefined): PlanPill {
  const list = rows ?? [];
  for (const row of list) {
    const insurer = insurerOf(row);
    if (!row.is_private && insurer?.name?.trim()) {
      return { kind: "plan", name: insurer.name.trim(), color: insurer.badge_color ?? null };
    }
  }
  if (list.some((r) => r.is_private)) {
    return { kind: "particular", name: "Particular", color: PARTICULAR_COLOR };
  }
  return { kind: "unknown", name: null, color: null };
}
