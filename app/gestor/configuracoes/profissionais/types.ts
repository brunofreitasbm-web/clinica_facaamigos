export type ContractRow = {
  id: string;
  tier: string;
  hourlyRate: number;
  validFrom: string;
  validTo: string | null;
};

export type TherapistRow = {
  id: string;
  fullName: string;
  current: ContractRow | null;
  history: ContractRow[];
};
