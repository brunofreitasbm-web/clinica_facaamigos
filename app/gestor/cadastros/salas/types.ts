export type ResourceRow = {
  id: string;
  name: string;
  category: string;
  notes: string | null;
};

export type RoomRow = {
  id: string;
  name: string;
  capacity: number;
  recommendedInterns: number | null;
  specialtyId: string | null;
  isAbaTraining: boolean;
};

/** Turma fixa de Treino ABA (sala própria + dia da semana + horário fechado). */
export type AbaClassRow = {
  id: string;
  roomId: string;
  roomName: string;
  capacity: number;
  dayOfWeek: number;
  startTime: string;
  active: boolean;
};

export type SpecialtyOption = {
  id: string;
  label: string;
};
