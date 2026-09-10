// lib/usual-payables.ts
// Catálogo das contas a pagar recorrentes de uma clínica de terapia no Brasil,
// usado pelo botão "Preencher contas usuais" da DRE (/gestor/financeiro/dre)
// para o gestor não ter que lembrar item por item na hora de montar o mês.
//
// A lista foi montada a partir do que a literatura de gestão financeira de
// clínicas trata como despesa fixa/recorrente do setor:
// - https://agilize.com.br/artigos/gestao-financeira-para-medicos-estrategias/
// - https://blog.communicare.com.br/fluxo-de-caixa-clinica/
// - https://somuscontabil.com.br/custos-e-despesas-de-atendimento-na-psicologia-saiba-como-calcular/
// - https://www.psicanaliseclinica.com/custos-fixos-e-variaveis/
// - https://www.agenciamedico.com.br/quanto-custa-montar-uma-clinica-de-psicologia
//
// São só rótulos e dia de vencimento sugerido — NENHUM valor vem preenchido.
// Valor de conta é dado da clínica, não estimativa de internet: quem digita é
// o gestor, item por item.
//
// `category` usa exatamente o enum de accounts_payable.category
// (aluguel | folha | fornecedores | impostos | marketing | manutencao | outros).

export type UsualPayableCategory = "aluguel" | "folha" | "fornecedores" | "impostos" | "marketing" | "manutencao" | "outros";

export type UsualPayable = {
  key: string;
  label: string;
  category: UsualPayableCategory;
  /** Dia do mês em que a conta costuma vencer — só um palpite de partida, editável. */
  dueDay: number;
  recurring: boolean;
  hint?: string;
};

export const USUAL_PAYABLES: UsualPayable[] = [
  { key: "aluguel", label: "Aluguel do imóvel", category: "aluguel", dueDay: 5, recurring: true },
  { key: "condominio", label: "Condomínio", category: "aluguel", dueDay: 10, recurring: true },
  { key: "iptu", label: "IPTU (parcela)", category: "impostos", dueDay: 10, recurring: true },
  { key: "energia", label: "Energia elétrica", category: "fornecedores", dueDay: 15, recurring: true },
  { key: "agua", label: "Água e esgoto", category: "fornecedores", dueDay: 15, recurring: true },
  { key: "internet", label: "Internet e telefonia", category: "fornecedores", dueDay: 15, recurring: true },
  { key: "folha", label: "Folha de pagamento (CLT)", category: "folha", dueDay: 5, recurring: true },
  { key: "pro-labore", label: "Pró-labore dos sócios", category: "folha", dueDay: 5, recurring: true },
  { key: "beneficios", label: "Vale-transporte e vale-refeição", category: "folha", dueDay: 5, recurring: true },
  { key: "fgts", label: "FGTS", category: "impostos", dueDay: 7, recurring: true },
  { key: "inss", label: "INSS / GPS", category: "impostos", dueDay: 20, recurring: true },
  { key: "das", label: "DAS — Simples Nacional", category: "impostos", dueDay: 20, recurring: true },
  { key: "iss", label: "ISS sobre serviços", category: "impostos", dueDay: 10, recurring: true },
  { key: "provisao-13", label: "Provisão de 13º e férias", category: "folha", dueDay: 30, recurring: true, hint: "Provisão mensal para não estourar o caixa em novembro/dezembro." },
  { key: "contador", label: "Honorários do contador", category: "fornecedores", dueDay: 10, recurring: true },
  { key: "software", label: "Software de gestão / prontuário eletrônico", category: "fornecedores", dueDay: 10, recurring: true },
  { key: "material-terapeutico", label: "Material terapêutico e de avaliação", category: "fornecedores", dueDay: 15, recurring: true },
  { key: "material-escritorio", label: "Material de escritório e papelaria", category: "fornecedores", dueDay: 15, recurring: true },
  { key: "limpeza", label: "Limpeza e produtos de higiene", category: "fornecedores", dueDay: 15, recurring: true },
  { key: "copa", label: "Copa e cozinha", category: "fornecedores", dueDay: 15, recurring: true },
  { key: "manutencao", label: "Manutenção predial e climatização", category: "manutencao", dueDay: 20, recurring: true },
  { key: "marketing", label: "Marketing e mídias pagas", category: "marketing", dueDay: 10, recurring: true },
  { key: "seguro", label: "Seguro do imóvel e responsabilidade civil", category: "outros", dueDay: 10, recurring: true },
  { key: "taxas-cartao", label: "Taxas de maquininha e gateway", category: "outros", dueDay: 30, recurring: true },
  { key: "tarifas-bancarias", label: "Tarifas bancárias", category: "outros", dueDay: 30, recurring: true },
  { key: "conselhos", label: "Anuidades e taxas de conselho (CRP/CRFa/CREFITO)", category: "outros", dueDay: 15, recurring: false },
  { key: "alvara", label: "Alvará, vigilância sanitária e taxas municipais", category: "impostos", dueDay: 20, recurring: false },
  { key: "supervisao", label: "Supervisão clínica e capacitação da equipe", category: "outros", dueDay: 10, recurring: true },
];

export const USUAL_PAYABLE_KEYS = new Set(USUAL_PAYABLES.map((item) => item.key));

/** Vencimento sugerido dentro da competência YYYY-MM, respeitando meses curtos. */
export function suggestedDueDate(competenceMonth: string, dueDay: number): string {
  const [year, month] = competenceMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(dueDay, lastDay);
  return `${competenceMonth}-${String(day).padStart(2, "0")}`;
}
