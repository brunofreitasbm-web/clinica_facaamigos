// lib/expiring-guides-pure.ts
//
// Regra única de "guia vencendo ou acabando" (§9.3 do PRD), usada pelo card da
// home da recepção e pela fila de pendências. Pura: sem banco, sem fuso — quem
// chama passa `today` e `limitDate` (hoje + 15 dias) em AAAA-MM-DD.
//
// Duas condições, avaliadas diferente de propósito:
//  - vencendo: a VALIDADE da guia cai entre hoje e o limite. É por guia — cada
//    guia tem a sua vigência.
//  - poucas sessões: o SALDO somado das guias ativas do paciente no mesmo
//    procedimento é ≤ 4 E já houve uso. Guia recém-lançada (0 usadas) ainda não
//    está "acabando", e várias guias pequenas do mesmo procedimento não são um
//    risco enquanto o saldo somado cobre as próximas sessões.

export const LOW_BALANCE_THRESHOLD = 4;

export type ActiveGuide = {
  id: string;
  patientId: string;
  patientName: string;
  insurerName: string;
  procedureCode: string;
  guideNumber: string | null;
  sessionsUsed: number;
  sessionsAuthorized: number;
  /** AAAA-MM-DD */
  validTo: string;
};

export type GuideAlertReason = "vencendo" | "poucas_sessoes";

export type ExpiringGuide = ActiveGuide & { reason: GuideAlertReason };

export type ExpiringPatientGroup = {
  patientId: string;
  patientName: string;
  insurerName: string;
  /** Pior motivo do paciente: vencendo pesa mais que poucas sessões. */
  reason: GuideAlertReason;
  /** Menor validade entre as guias que dispararam alerta. */
  nextValidTo: string;
  /** Menor saldo (sessões restantes) entre os procedimentos em alerta de saldo; null se só há alerta de validade. */
  lowestBalance: number | null;
  guides: ExpiringGuide[];
};

export function groupExpiringGuides(guides: ActiveGuide[], today: string, limitDate: string): ExpiringPatientGroup[] {
  const pools = new Map<string, { used: number; authorized: number }>();
  for (const g of guides) {
    const key = `${g.patientId}|${g.procedureCode}`;
    const pool = pools.get(key) ?? { used: 0, authorized: 0 };
    pool.used += g.sessionsUsed;
    pool.authorized += g.sessionsAuthorized;
    pools.set(key, pool);
  }

  const byPatient = new Map<string, ExpiringPatientGroup>();
  for (const g of guides) {
    const pool = pools.get(`${g.patientId}|${g.procedureCode}`)!;
    const poolRemaining = pool.authorized - pool.used;
    const expiring = g.validTo >= today && g.validTo <= limitDate;
    const lowBalance = poolRemaining <= LOW_BALANCE_THRESHOLD && pool.used > 0;
    if (!expiring && !lowBalance) continue;

    const reason: GuideAlertReason = expiring ? "vencendo" : "poucas_sessoes";
    let group = byPatient.get(g.patientId);
    if (!group) {
      group = {
        patientId: g.patientId,
        patientName: g.patientName,
        insurerName: g.insurerName,
        reason,
        nextValidTo: g.validTo,
        lowestBalance: null,
        guides: [],
      };
      byPatient.set(g.patientId, group);
    }
    group.guides.push({ ...g, reason });
    if (reason === "vencendo") group.reason = "vencendo";
    if (g.validTo < group.nextValidTo) group.nextValidTo = g.validTo;
    if (lowBalance && (group.lowestBalance === null || poolRemaining < group.lowestBalance)) {
      group.lowestBalance = poolRemaining;
    }
  }

  const result = [...byPatient.values()];
  for (const group of result) group.guides.sort((a, b) => a.validTo.localeCompare(b.validTo));
  result.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === "vencendo" ? -1 : 1;
    if (a.reason === "vencendo") return a.nextValidTo.localeCompare(b.nextValidTo);
    return (a.lowestBalance ?? 0) - (b.lowestBalance ?? 0);
  });
  return result;
}
