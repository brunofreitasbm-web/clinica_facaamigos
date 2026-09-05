export type ServicePriceRow = {
  id: string;
  procedureCode: string;
  procedureName: string;
  insurerId: string;
  insurerName: string;
  cost: number | null;
  price: number;
  validFrom: string;
  validTo: string | null;
};

export type InsurerOption = {
  id: string;
  name: string;
};
