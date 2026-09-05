export type AppointmentType = {
  id: string;
  name: string;
  modality: string;
  durationMinutes: number;
  displayIntervalMinutes: number;
  recurrence: string;
  active: boolean;
};

export const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
};

export const RECURRENCE_LABEL: Record<string, string> = {
  unica: "Única",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};
