import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

/**
 * Checklist de entrada da recepção (Módulo 3 MAAIS, slide 4 — categorias
 * criadas em 20260906000006_intake_documents.sql).
 *
 * Não existe tabela de "itens marcados": o item está cumprido quando o
 * documento correspondente existe em `documents` para o paciente. Marcar um
 * checkbox que não vira anexo não prova nada pro faturamento nem pro
 * jurídico, e faria a meta `intake_complete_rate` (§10.1, migration
 * 20260910071000_intake_complete_rate_metric.sql) medir clique em vez de
 * documento — o cálculo da meta lê exatamente estas mesmas categorias.
 */
export const INTAKE_CHECKLIST_ITEMS = [
  {
    category: "pedido_medico",
    label: "Pedido médico com CID",
    hint: "Exigência para faturamento e laudo inicial",
    insuranceOnly: false,
  },
  {
    category: "carteirinha",
    label: "Carteirinha do convênio",
    hint: "Frente e verso visíveis, com validade",
    insuranceOnly: true,
  },
  {
    category: "documento_responsavel",
    label: "Documento do responsável (RG/CPF)",
    hint: "Comprovação de vínculo com a criança",
    insuranceOnly: false,
  },
  {
    category: "termo_lgpd",
    label: "Termo LGPD assinado",
    hint: "Consentimento para tratamento de dados sensíveis",
    insuranceOnly: false,
  },
  {
    category: "termo_imagem",
    label: "Termo de uso de imagem assinado",
    hint: "Autorização para gravações clínicas/pedagógicas",
    insuranceOnly: false,
  },
  {
    category: "contrato",
    label: "Contrato de prestação de serviços",
    hint: "Assinatura do contrato de adesão clínica",
    insuranceOnly: false,
  },
] as const;

export type IntakeChecklistItem = {
  category: string;
  label: string;
  hint: string;
  /** false quando é particular e o item só vale pra convênio (carteirinha). */
  required: boolean;
  done: boolean;
};

export type IntakeChecklistRow = {
  patientId: string;
  patientName: string;
  /** null = 1ª sessão ainda não agendada. */
  firstSessionAt: string | null;
  hasInsurance: boolean;
  items: IntakeChecklistItem[];
  doneCount: number;
  requiredCount: number;
  complete: boolean;
};

/**
 * Pacientes que ainda contam pro checklist: os que não têm 1ª sessão
 * registrada e os cuja 1ª sessão ainda vai acontecer. Depois da 1ª sessão o
 * prazo já passou — o resultado vira histórico e é o fechamento mensal de
 * `intake_complete_rate` que dá a nota, não este painel.
 */
export async function getIntakeChecklistRows(
  supabase: Supa,
  clinicId: string,
): Promise<IntakeChecklistRow[]> {
  const nowISO = new Date().toISOString();
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, first_session_at, status")
    .eq("clinic_id", clinicId)
    .in("status", ["interessado", "avaliacao", "ativo"])
    .or(`first_session_at.is.null,first_session_at.gte.${nowISO}`)
    .order("full_name");

  const rows = patients ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((p) => p.id);
  const [{ data: docs }, { data: insurances }] = await Promise.all([
    supabase.from("documents").select("patient_id, category").in("patient_id", ids),
    supabase.from("patient_insurance").select("patient_id, is_private").in("patient_id", ids),
  ]);

  const categoriesByPatient = new Map<string, Set<string>>();
  for (const d of docs ?? []) {
    const set = categoriesByPatient.get(d.patient_id) ?? new Set<string>();
    set.add(d.category);
    categoriesByPatient.set(d.patient_id, set);
  }
  const withInsurer = new Set(
    (insurances ?? []).filter((i) => i.is_private === false).map((i) => i.patient_id),
  );

  return rows.map((p) => {
    const owned = categoriesByPatient.get(p.id) ?? new Set<string>();
    const hasInsurance = withInsurer.has(p.id);
    const items: IntakeChecklistItem[] = INTAKE_CHECKLIST_ITEMS.map((item) => ({
      category: item.category,
      label: item.label,
      hint: item.hint,
      required: item.insuranceOnly ? hasInsurance : true,
      done: owned.has(item.category),
    }));
    const required = items.filter((i) => i.required);
    const doneCount = required.filter((i) => i.done).length;
    return {
      patientId: p.id,
      patientName: p.full_name,
      firstSessionAt: p.first_session_at,
      hasInsurance,
      items,
      doneCount,
      requiredCount: required.length,
      complete: doneCount === required.length,
    };
  });
}
