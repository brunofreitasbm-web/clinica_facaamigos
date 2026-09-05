/**
 * Calculadora de Repasse Financeiro aos Terapeutas (Split PJ)
 */

export interface TherapistPayoutSummary {
  therapistId: string;
  therapistName: string;
  councilNumber: string;
  discipline: string;
  pixKey: string;
  totalSessions: number;
  grossAmount: number;
  clinicFeePercentage: number;
  clinicFeeAmount: number;
  netPayoutAmount: number;
  status: "pendente" | "aprovado" | "pago";
}

export const MOCK_PAYOUTS: TherapistPayoutSummary[] = [
  {
    therapistId: "t-1",
    therapistName: "Dra. Luciana Garcia",
    councilNumber: "CREFITO-3 98765-F",
    discipline: "Terapia Ocupacional (ABA)",
    pixKey: "luciana.garcia@clinicafacaamigos.com.br",
    totalSessions: 42,
    grossAmount: 7560.0,
    clinicFeePercentage: 30, // 30% retido pela clínica
    clinicFeeAmount: 2268.0,
    netPayoutAmount: 5292.0,
    status: "aprovado",
  },
  {
    therapistId: "t-2",
    therapistName: "Dr. Marcelo Ramos",
    councilNumber: "CRP 06/123456",
    discipline: "Psicologia Comportamental",
    pixKey: "123.456.789-00",
    totalSessions: 38,
    grossAmount: 7220.0,
    clinicFeePercentage: 25,
    clinicFeeAmount: 1805.0,
    netPayoutAmount: 5415.0,
    status: "pendente",
  },
  {
    therapistId: "t-3",
    therapistName: "Dra. Juliana Prado",
    councilNumber: "CRFa 2-18492",
    discipline: "Fonoaudiologia Neurofuncional",
    pixKey: "juliana.fono@gmail.com",
    totalSessions: 29,
    grossAmount: 5510.0,
    clinicFeePercentage: 25,
    clinicFeeAmount: 1377.5,
    netPayoutAmount: 4132.5,
    status: "pendente",
  },
];

export function calculateTotalPayout(items: TherapistPayoutSummary[]) {
  return items.reduce(
    (acc, curr) => ({
      totalGross: acc.totalGross + curr.grossAmount,
      totalClinicFee: acc.totalClinicFee + curr.clinicFeeAmount,
      totalNetPayout: acc.totalNetPayout + curr.netPayoutAmount,
      totalSessions: acc.totalSessions + curr.totalSessions,
    }),
    { totalGross: 0, totalClinicFee: 0, totalNetPayout: 0, totalSessions: 0 }
  );
}
