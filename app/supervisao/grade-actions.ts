"use server";

// Server actions da aba Grade (app/supervisao/grade-panel.tsx) — expõem
// lib/grade-recurrence.ts pro app. A geração periódica de ~8 semanas por
// série ativa já roda sozinha via pg_cron (`regenerate_active_grade_sessions`,
// supabase/migrations/20260906000017_grade_recurrence_generation.sql); estas
// actions cobrem os dois casos que precisam de uma decisão humana:
//   1) gerar mais semanas de uma série específica sob demanda (ex.: acabou
//      de cadastrar o paciente e quer ver a agenda preenchida na hora, sem
//      esperar o cron rodar de madrugada);
//   2) editar a grade (mudar dia/horário/terapeuta/sala a partir de uma
//      data), que cancela o futuro da série antiga e nasce uma série nova.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  generateSeriesSessions,
  editGradeSeries,
  type GradeSeriesPattern,
  type GenerateOccurrenceResult,
} from "@/lib/grade-recurrence";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function revalidateGradeViews() {
  revalidatePath("/supervisao");
  revalidatePath("/recepcao/agenda");
  revalidatePath("/recepcao");
}

/**
 * Gera mais `weeksAhead` semanas (padrão 8) de uma série já existente,
 * derivando o padrão da sessão mais recente e não cancelada daquele
 * `recurrenceId` — usado pelo botão "Gerar próximas semanas" de uma série
 * específica na grade.
 */
export async function generateSeriesSessionsAction(
  recurrenceId: string,
  weeksAhead = 8,
): Promise<ActionResult<GenerateOccurrenceResult[]>> {
  if (!recurrenceId) {
    return { success: false, error: "Série inválida." };
  }

  const supabase = await createClient();

  try {
    const results = await generateSeriesSessions(supabase, recurrenceId, weeksAhead);
    revalidateGradeViews();
    return { success: true, data: results };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Não foi possível gerar as sessões." };
  }
}

export type EditGradeSeriesInput = {
  oldRecurrenceId: string;
  effectiveDate: string; // YYYY-MM-DD
  cancelReason: string;
  newPattern: GradeSeriesPattern;
  weeksAhead?: number;
};

/**
 * Editar a grade: cancela (cancelada_clinica) as sessões futuras não
 * realizadas da série antiga a partir de `effectiveDate` e gera a série
 * nova com o padrão informado — mesma janela (`weeksAhead`, padrão 8
 * semanas) usada pela geração normal. Sessões passadas/já realizadas da
 * série antiga nunca são tocadas.
 */
export async function editGradeSeriesAction(
  input: EditGradeSeriesInput,
): Promise<ActionResult<{ cancelledCount: number; newRecurrenceId: string; results: GenerateOccurrenceResult[] }>> {
  if (!input.oldRecurrenceId || !input.effectiveDate || !input.cancelReason?.trim()) {
    return { success: false, error: "Preencha a série, a data de vigência e o motivo da mudança." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Sessão expirada. Faça login novamente." };
  }

  try {
    const result = await editGradeSeries(supabase, {
      oldRecurrenceId: input.oldRecurrenceId,
      effectiveDate: input.effectiveDate,
      cancelReason: input.cancelReason.trim(),
      cancelledBy: user.id,
      newPattern: input.newPattern,
      weeksAhead: input.weeksAhead,
    });
    revalidateGradeViews();
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Não foi possível editar a grade." };
  }
}
