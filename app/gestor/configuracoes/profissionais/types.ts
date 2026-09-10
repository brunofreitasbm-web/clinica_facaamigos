export type ContractRow = {
  id: string;
  tier: string;
  modulePrice: number;
  attendancesPerModule: number;
  docDeadlineDays: number;
  noshowCompensationPct: number;
  validFrom: string;
  validTo: string | null;
};

export type TherapistRow = {
  id: string;
  fullName: string;
  current: ContractRow | null;
  history: ContractRow[];
};
