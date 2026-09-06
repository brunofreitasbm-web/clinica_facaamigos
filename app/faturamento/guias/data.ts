import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { TissValidationItem, TissValidationIssue } from "@/lib/tiss/pre-validate";
import { preValidateTissBatch } from "@/lib/tiss/pre-validate";

type Supa = SupabaseClient<Database>;

export type GuiaPeriodGroup = {
  billingPeriodId: string;
  insurerName: string;
  ansCode: string | null;
  providerCode: string | null;
  competenceLabel: string;
  /**
   * `TissValidationItem` é um superset de `TissGuiaItem` (o tipo que
   * `generateTissXml` espera) — os campos extras (guia, sessão, tabela de
   * preço) só existem pra alimentar `preValidateTissBatch`; o gerador de XML
   * ignora o que não conhece.
   */
  guias: TissValidationItem[];
  /** Pré-validação já calculada pra TODAS as guias do grupo (não só as selecionadas). */
  issues: TissValidationIssue[];
};

export type ClinicHeaderInfo = {
  nomePrestador: string;
  cnpjPrestador: string;
};

/**
 * Guias pendentes de envio: `billing_items` de competências ainda não
 * marcadas `enviada`/`paga` (mesmo universo que `exportCompetenceCsv` já usa
 * para o CSV do faturista — aqui é só um formato de saída diferente,
 * XML TISS em vez de CSV). Agrupado por `billing_period` porque um lote TISS
 * é sempre de um único convênio+competência.
 */
export async function getPendingGuias(supabase: Supa, clinicId: string): Promise<GuiaPeriodGroup[]> {
  const { data: insurers } = await supabase
    .from("insurers")
    .select("id, name, ans_code, provider_code")
    .eq("clinic_id", clinicId);
  const insurerList = insurers ?? [];
  if (insurerList.length === 0) return [];
  const insurerById = new Map(insurerList.map((i) => [i.id, i]));
  const insurerIds = insurerList.map((i) => i.id);

  const { data: periods } = await supabase
    .from("billing_periods")
    .select("id, insurer_id, competence_month, status")
    .in("insurer_id", insurerIds)
    .in("status", ["aberta", "fechada"]);
  const periodList = periods ?? [];
  if (periodList.length === 0) return [];
  const periodById = new Map(periodList.map((p) => [p.id, p]));

  const { data: priceTables } = await supabase
    .from("insurer_price_tables")
    .select("insurer_id, procedure_code, procedure_name")
    .in("insurer_id", insurerIds);
  const procedureNameByInsurerCode = new Map((priceTables ?? []).map((pt) => [`${pt.insurer_id}:${pt.procedure_code}`, pt.procedure_name]));

  // Campos extras (status/validade/sessões da guia, carteirinha, nota de sessão)
  // só servem pra pré-validação (lib/tiss/pre-validate.ts) — generateTissXml
  // continua lendo só os campos de TissGuiaItem que já conhecia.
  const { data: items } = await supabase
    .from("billing_items")
    .select(
      `id, billing_period_id, procedure_code, amount, appointment_id,
      appointments(starts_at, discipline, patient_id, patients(full_name),
      authorizations(guide_number, status, valid_from, valid_to, sessions_authorized, sessions_used,
      patient_insurance(card_number, card_valid_until)),
      session_notes(signed_at))`,
    )
    .in(
      "billing_period_id",
      periodList.map((p) => p.id),
    )
    .order("billing_period_id");

  const groups = new Map<string, GuiaPeriodGroup>();

  for (const item of items ?? []) {
    const period = periodById.get(item.billing_period_id);
    if (!period) continue;
    const insurer = insurerById.get(period.insurer_id);
    if (!insurer) continue;

    const appt = item.appointments as {
      starts_at: string;
      discipline: string;
      patient_id: string | null;
      patients: { full_name: string } | null;
      authorizations: {
        guide_number: string | null;
        status: string;
        valid_from: string | null;
        valid_to: string | null;
        sessions_authorized: number;
        sessions_used: number;
        patient_insurance: { card_number: string | null; card_valid_until: string | null } | null;
      } | null;
      session_notes: { signed_at: string | null }[] | null;
    } | null;

    let group = groups.get(period.id);
    if (!group) {
      const [year, month] = period.competence_month.slice(0, 7).split("-");
      group = {
        billingPeriodId: period.id,
        insurerName: insurer.name,
        ansCode: insurer.ans_code,
        providerCode: insurer.provider_code,
        competenceLabel: `${month}/${year}`,
        guias: [],
        issues: [],
      };
      groups.set(period.id, group);
    }

    const auth = appt?.authorizations ?? null;
    const sessionNotes = appt?.session_notes ?? [];
    // pega a nota mais recente assinada, ou a primeira se nenhuma estiver assinada
    const signedNote = sessionNotes.find((sn) => sn.signed_at) ?? sessionNotes[0] ?? null;

    group.guias.push({
      id: item.id,
      appointmentId: item.appointment_id,
      patientId: appt?.patient_id ?? null,
      numeroGuiaPrestador: auth?.guide_number ?? `SEM-GUIA-${item.id.slice(0, 8)}`,
      numeroCarteira: auth?.patient_insurance?.card_number ?? "",
      nomeBeneficiario: appt?.patients?.full_name ?? "—",
      codigoConvenio: insurer.ans_code ?? "",
      nomeConvenio: insurer.name,
      procedimentoCodigo: item.procedure_code,
      procedimentoDescricao:
        procedureNameByInsurerCode.get(`${period.insurer_id}:${item.procedure_code}`) ?? appt?.discipline ?? item.procedure_code,
      dataAtendimento: appt?.starts_at ? appt.starts_at.slice(0, 10) : "",
      valorTotal: Number(item.amount),
      codigoPrestador: insurer.provider_code ?? "",
      hasSessionNote: sessionNotes.length > 0,
      sessionNoteSignedAt: signedNote?.signed_at ?? null,
      authorization: auth
        ? {
            status: auth.status,
            validFrom: auth.valid_from,
            validTo: auth.valid_to,
            sessionsAuthorized: auth.sessions_authorized,
            sessionsUsed: auth.sessions_used,
          }
        : null,
      cardValidUntil: auth?.patient_insurance?.card_valid_until ?? null,
      procedureInPriceTable: procedureNameByInsurerCode.has(`${period.insurer_id}:${item.procedure_code}`),
    });
  }

  for (const group of groups.values()) {
    group.issues = preValidateTissBatch(group.guias);
  }

  return [...groups.values()];
}

export async function getClinicHeaderInfo(supabase: Supa, clinicId: string): Promise<ClinicHeaderInfo> {
  const { data: clinic } = await supabase.from("clinics").select("name, cnpj").eq("id", clinicId).maybeSingle();
  return {
    nomePrestador: clinic?.name ?? "",
    cnpjPrestador: clinic?.cnpj ?? "",
  };
}
