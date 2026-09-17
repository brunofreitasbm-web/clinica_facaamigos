import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const PROASA_PROCEDURES_SEED = [
  {
    procedure_code: "9922200008",
    procedure_name: "Consulta/sessão de terapia ocupacional - método ABA",
    price: 90.00,
    valid_from: "2024-01-25",
    duration_minutes: 55,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Codificação para pacientes autistas; quantidade conforme pedido médico com CID.",
    escalation_rule: null,
  },
  {
    procedure_code: "50001221",
    procedure_name: "Consulta ambulatorial em psicologia",
    price: 45.00,
    valid_from: "2024-01-25",
    duration_minutes: 35,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Limitado a 1 sessão/semana; exceção exige justificativa (auditoria pós-faturamento).",
    escalation_rule: null,
  },
  {
    procedure_code: "50000470",
    procedure_name: "Sessão de psicoterapia individual por psicólogo",
    price: 45.00,
    valid_from: "2024-01-25",
    duration_minutes: 40,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Limitado a 1 sessão/semana; exceção exige justificativa (auditoria pós-faturamento).",
    escalation_rule: null,
  },
  {
    procedure_code: "50000586",
    procedure_name: "Consulta ambulatorial de fonoaudiologia",
    price: 45.00,
    valid_from: "2024-01-25",
    duration_minutes: 35,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: null,
    escalation_rule: null,
  },
  {
    procedure_code: "50000616",
    procedure_name: "Sessão individual ambulatorial de fonoaudiologia",
    price: 45.00,
    valid_from: "2024-01-25",
    duration_minutes: 35,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: null,
    escalation_rule: null,
  },
  {
    procedure_code: "50000055",
    procedure_name: "Consulta individual ambulatorial em terapia ocupacional",
    price: 45.00,
    valid_from: "2024-01-25",
    duration_minutes: 35,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: null,
    escalation_rule: null,
  },
  {
    procedure_code: "50000080",
    procedure_name: "Sessão individual ambulatorial em terapia ocupacional",
    price: 45.00,
    valid_from: "2024-01-25",
    duration_minutes: 35,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: null,
    escalation_rule: null,
  },
  {
    procedure_code: "50000560",
    procedure_name: "Consulta ambulatorial por nutricionista",
    price: 50.00,
    valid_from: "2024-01-25",
    duration_minutes: 35,
    requires_prior_authorization: true,
    max_sessions_per_guide: null,
    medical_order_validity_months: null,
    guide_validity_days: null,
    session_frequency_note: "Não é seriada (guia SADT Tipo 2). Até 6 consultas/ano com o mesmo pedido, 1 a cada 30 dias. Mais de 1/mês exige auditoria técnica.",
    escalation_rule: null,
  },
  {
    procedure_code: "41301048",
    procedure_name: "Bioimpedanciometria (ambulatorial) exame",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: null,
    medical_order_validity_months: null,
    guide_validity_days: null,
    session_frequency_note: null,
    escalation_rule: null,
  },
  {
    procedure_code: "20103646",
    procedure_name: "Reabilitação perineal com biofeedback",
    price: 50.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: null,
    medical_order_validity_months: null,
    guide_validity_days: null,
    session_frequency_note: null,
    escalation_rule: null,
  },
  {
    procedure_code: "31601014",
    procedure_name: "Acupuntura por sessão",
    price: 40.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: null,
    medical_order_validity_months: null,
    guide_validity_days: null,
    session_frequency_note: null,
    escalation_rule: null,
  },
  {
    procedure_code: "50000144",
    procedure_name: "Consulta ambulatorial em fisioterapia",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: null,
    medical_order_validity_months: null,
    guide_validity_days: 90,
    session_frequency_note: "DUT nº102: 2 consultas por CID apresentado ao ano.",
    escalation_rule: null,
  },
  {
    procedure_code: "50000160",
    procedure_name: "Atend. fisioterapêutico ambulatorial — disfunção músculo-esquelética",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).",
    escalation_rule: "Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.",
  },
  {
    procedure_code: "50000233",
    procedure_name: "Atend. fisioterapêutico ambulatorial — genito-urinário/reprodutor/proctológico",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).",
    escalation_rule: "Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.",
  },
  {
    procedure_code: "50000713",
    procedure_name: "Atend. fisioterapêutico ambulatorial — lesão SNC/periférico (independente/dep. parcial)",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).",
    escalation_rule: "Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.",
  },
  {
    procedure_code: "50000730",
    procedure_name: "Atend. fisioterapêutico ambulatorial individual — disfunção respiratória",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).",
    escalation_rule: "Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.",
  },
  {
    procedure_code: "50000195",
    procedure_name: "Atend. fisioterapêutico ambulatorial — disfunção por queimaduras",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).",
    escalation_rule: "Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.",
  },
  {
    procedure_code: "50000209",
    procedure_name: "Atend. fisioterapêutico ambulatorial — disfunção linfático/vascular periférico",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).",
    escalation_rule: "Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.",
  },
  {
    procedure_code: "50000217",
    procedure_name: "Atend. fisioterapêutico ambulatorial — pré/pós cirúrgico e recuperação de tecidos",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).",
    escalation_rule: "Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.",
  },
  {
    procedure_code: "50000721",
    procedure_name: "Atend. fisioterapêutico ambulatorial — lesão SNC/periférico (dependente)",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).",
    escalation_rule: "Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.",
  },
  {
    procedure_code: "50000756",
    procedure_name: "Atend. fisioterapêutico ambulatorial individual — disfunção cardiovascular",
    price: 30.00,
    valid_from: "2024-01-25",
    duration_minutes: null,
    requires_prior_authorization: true,
    max_sessions_per_guide: 10,
    medical_order_validity_months: 6,
    guide_validity_days: 90,
    session_frequency_note: "Relatório a cada 10 sessões deve acompanhar o faturamento (senão glosa).",
    escalation_rule: "Até 20 sessões: 10 iniciais + 10 mediante relatório. Até 30: reavaliação médica + relatório. Acima de 30: segunda opinião + laudos/imagem.",
  },
];

export const PROASA_GLOSA_REASONS_SEED = [
  { code: "PROASA-01", description: "Procedimento eletivo sem autorização prévia (Anexo V, item 1)", category: "autorizacao_previa", prevention_hint: "Nunca realizar procedimento eletivo sem autorização ativa no Autorizador Web antes do atendimento." },
  { code: "PROASA-02", description: "Cobrança em discordância com o contrato / fatura ou recurso fora do prazo (Anexo V, item 2)", category: "prazo", prevention_hint: "Faturar em até 90 dias do atendimento; recurso de glosa em até 30 dias da comunicação ou do pagamento, o que ocorrer primeiro." },
  { code: "PROASA-03", description: "Alteração ou rasura na documentação apresentada (Anexo V, item 3)", category: "documentacao", prevention_hint: "Conferir guia/laudo sem emendas antes de anexar ao faturamento; refazer documento rasurado." },
  { code: "PROASA-04", description: "Identificação profissional incompleta nos registros (Anexo V, item 4)", category: "identificacao_profissional", prevention_hint: "Confirmar nome completo e registro do conselho de classe (CRP/CREFITO/CRN/CRFa) preenchidos na guia/relatório." },
  { code: "PROASA-05", description: "Guia sem assinatura do beneficiário ou carimbo do profissional (Anexo V, item 5)", category: "assinatura_beneficiario", prevention_hint: "Não liberar checkout/faturamento sem assinatura do beneficiário (ou responsável) e carimbo do profissional na guia." },
  { code: "PROASA-06", description: "Guia não devidamente preenchida (Anexo V, item 6)", category: "guia_incompleta", prevention_hint: "Revisar todos os campos obrigatórios da guia TISS antes do envio." },
  { code: "PROASA-07", description: "Documentação exigida pelos Anexos III/III.A/III.B/III.C/IV não enviada (Anexo V, item 7)", category: "anexos_obrigatorios", prevention_hint: "Fono/Psico/TO: pedido médico + guia assinada + recibo por sessão. Nutrição: pedido médico + guia. Fisioterapia: relatório a cada 10 sessões." },
  { code: "PROASA-08", description: "Autorização não anexada ao faturamento (Anexo V, item 8)", category: "anexos_obrigatorios", prevention_hint: "Confirmar que a autorização/guia está anexada no Portal (Autorizador Web) antes de fechar a competência." },
];

export async function ensureProasaCatalog(insurerId: string, insurerName: string) {
  if (!insurerName.toUpperCase().includes("PROASA")) return;

  let dbClient: any;
  try {
    dbClient = createAdminClient();
  } catch {
    dbClient = await createClient();
  }

  // Verificar se a tabela de preços está vazia para este convênio
  const { data: existingPrices } = await dbClient
    .from("insurer_price_tables")
    .select("id")
    .eq("insurer_id", insurerId)
    .limit(1);

  if (!existingPrices || existingPrices.length === 0) {
    const pricesToInsert = PROASA_PROCEDURES_SEED.map((p) => ({
      insurer_id: insurerId,
      ...p,
    }));
    const { error } = await dbClient.from("insurer_price_tables").insert(pricesToInsert);
    if (error) throw new Error(`Falha ao importar tabela de preços PROASA: ${error.message}`);
  }

  // Verificar se o catálogo de glosas está vazio para este convênio
  const { data: existingGlosas } = await dbClient
    .from("glosa_reason_catalog")
    .select("id")
    .eq("insurer_id", insurerId)
    .limit(1);

  if (!existingGlosas || existingGlosas.length === 0) {
    const glosasToInsert = PROASA_GLOSA_REASONS_SEED.map((g) => ({
      insurer_id: insurerId,
      ...g,
    }));
    const { error } = await dbClient.from("glosa_reason_catalog").insert(glosasToInsert);
    if (error) throw new Error(`Falha ao importar catálogo de glosas PROASA: ${error.message}`);
  }
}
