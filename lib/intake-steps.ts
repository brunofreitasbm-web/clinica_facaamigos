import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Checklist operacional de entrada (Módulo 3 MAAIS, slide 20 "checklist
 * operacional de entrada de clientes"). Uma linha por (paciente, etapa) em
 * `intake_steps` — ver supabase/migrations/20260906000001_intake_journey.sql.
 * A maioria das etapas é concluída automaticamente por triggers de banco
 * quando o evento correspondente acontece (ex.: aprovar o plano conclui
 * `pdi_validado`); esta lista só documenta a etapa e serve pra render.
 */
export type IntakeStepKey =
  | "primeiro_contato"
  | "agendamento_anamnese"
  | "contrato_enviado"
  | "contrato_assinado"
  | "pagamento_confirmado"
  | "grupo_whatsapp"
  | "anamnese_realizada"
  | "equipe_definida"
  | "planejamento_avaliacao"
  | "avaliacoes_realizadas"
  | "reuniao_interdisciplinar"
  | "pdi_construido"
  | "pdi_validado"
  | "devolutiva_familia";

export type IntakeStepStatus = "pendente" | "concluida" | "nao_aplicavel";

type IntakeStepDef = { key: IntakeStepKey; label: string; responsavel: string };

export const INTAKE_STEP_CATALOG: IntakeStepDef[] = [
  { key: "primeiro_contato", label: "Primeiro contato", responsavel: "Recepção" },
  { key: "agendamento_anamnese", label: "Agendamento da anamnese", responsavel: "Recepção" },
  { key: "contrato_enviado", label: "Contrato enviado", responsavel: "Recepção" },
  { key: "contrato_assinado", label: "Contrato assinado", responsavel: "Recepção" },
  { key: "pagamento_confirmado", label: "Pagamento confirmado (particular)", responsavel: "Recepção" },
  { key: "grupo_whatsapp", label: "Inclusão no grupo de WhatsApp", responsavel: "Recepção" },
  { key: "anamnese_realizada", label: "Anamnese realizada", responsavel: "RT / Supervisor de área" },
  { key: "equipe_definida", label: "Definição da equipe de avaliação", responsavel: "Supervisor geral / RT" },
  { key: "planejamento_avaliacao", label: "Planejamento da avaliação", responsavel: "Supervisor geral / RT" },
  { key: "avaliacoes_realizadas", label: "Avaliações por área realizadas", responsavel: "Terapeutas" },
  { key: "reuniao_interdisciplinar", label: "Reunião técnica multidisciplinar", responsavel: "Equipe" },
  { key: "pdi_construido", label: "Construção do PDI", responsavel: "Terapeutas e supervisores" },
  { key: "pdi_validado", label: "Revisão e validação do PDI", responsavel: "Supervisor geral / RT" },
  { key: "devolutiva_familia", label: "Devolutiva à família", responsavel: "RT / Supervisor de área" },
];

export type IntakeStepRow = {
  id: string;
  step_key: IntakeStepKey;
  status: IntakeStepStatus;
  due_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completedByName: string | null;
  notes: string | null;
};

type Supa = SupabaseClient<Database>;

/** Checklist completo de um paciente, já na ordem do catálogo. */
export async function getIntakeSteps(supabase: Supa, patientId: string): Promise<IntakeStepRow[]> {
  const { data } = await supabase
    .from("intake_steps")
    .select("id, step_key, status, due_at, completed_at, completed_by, notes, profiles(full_name)")
    .eq("patient_id", patientId);

  const byKey = new Map(
    (data ?? []).map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return [
        r.step_key,
        {
          id: r.id,
          step_key: r.step_key as IntakeStepKey,
          status: r.status as IntakeStepStatus,
          due_at: r.due_at,
          completed_at: r.completed_at,
          completed_by: r.completed_by,
          completedByName: profile?.full_name ?? null,
          notes: r.notes,
        },
      ];
    }),
  );

  return INTAKE_STEP_CATALOG.map(
    (def) =>
      byKey.get(def.key) ?? {
        id: def.key,
        step_key: def.key,
        status: "pendente" as const,
        due_at: null,
        completed_at: null,
        completed_by: null,
        completedByName: null,
        notes: null,
      },
  );
}

/** Etapa da devolutiva (prazo dos 60 dias, slide 10 etapa 6). */
export function getPdiDeadlineStep(steps: IntakeStepRow[]): IntakeStepRow | null {
  return steps.find((s) => s.step_key === "devolutiva_familia") ?? null;
}

export function daysUntil(dueAt: string): number {
  return Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
}
