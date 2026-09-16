export type AppointmentType = {
  id: string;
  name: string;
  modality: string;
  durationMinutes: number;
  displayIntervalMinutes: number;
  recurrence: string;
  requiresInternRatio: boolean;
  active: boolean;
  insurerId?: string | null;
  insurerName?: string | null;
  procedureCode?: string | null;
};

export type InsurerOption = {
  id: string;
  name: string;
  procedures: { code: string; name: string }[];
};

export const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
};

export const RECURRENCE_LABEL: Record<string, string> = {
  unica: "Única / Avulso",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

