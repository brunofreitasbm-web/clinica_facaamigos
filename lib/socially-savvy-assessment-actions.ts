"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import {
  SOCIALLY_SAVVY_CATALOG,
  SOCIALLY_SAVVY_MAX_ROUNDS,
  computeSociallySavvyResults,
  isSociallySavvyItemCode,
  isSociallySavvyScore,
  type SociallySavvyResponses,
} from "@/lib/socially-savvy";

export type SociallySavvyActionResult = { success: true; id: string } | { success: false; error: string };

/**
 * Aceita só códigos do catálogo com pontuação válida. Entradas desconhecidas
 * são descartadas em silêncio em vez de rejeitar o salvamento inteiro — mesma
 * escolha de sanitizeResponses em lib/fono-assessment-actions.ts: um rascunho
 * não deve travar por resquício de estado antigo no formulário.
 */
function parseResponses(raw: FormDataEntryValue | null): SociallySavvyResponses {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  const out: SociallySavvyResponses = {};
  for (const [code, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isSociallySavvyItemCode(code)) continue;
    const score = String(value);
    if (isSociallySavvyScore(score)) out[code] = score;
  }
  return out;
}

export async function saveSociallySavvyAssessment(
  patientId: string,
  assessmentId: string | null,
  formData: FormData,
): Promise<SociallySavvyActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const assessmentDate = String(formData.get("assessment_date") ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(assessmentDate)) {
    return { success: false, error: "Informe a data da avaliação." };
  }

  const round = Number(formData.get("round"));
  if (!Number.isInteger(round) || round < 1 || round > SOCIALLY_SAVVY_MAX_ROUNDS) {
    return { success: false, error: `A aplicação deve ser um número de 1 a ${SOCIALLY_SAVVY_MAX_ROUNDS}.` };
  }

  const { data: patient } = await supabase.from("patients").select("id, clinic_id").eq("id", patientId).maybeSingle();
  if (!patient) return { success: false, error: "Paciente não encontrado ou sem permissão de acesso." };

  const responses = parseResponses(formData.get("responses"));
  const finalize = formData.get("finalize") === "1";
  const observations = formData.get("observations");

  // Concluir exige o protocolo inteiro respondido — quem não observou a
  // habilidade marca "NA", como manda a instrução da planilha ("procure não
  // deixar espaços vazios"). Um item em branco viraria 0 no consolidado e
  // distorceria a comparação entre aplicações.
  const results = computeSociallySavvyResults(SOCIALLY_SAVVY_CATALOG, responses);
  if (finalize) {
    const missing = results.areas.reduce((n, area) => n + area.unansweredItems, 0);
    if (missing > 0) {
      return {
        success: false,
        error: `Para concluir, pontue as ${missing} habilidades ainda em branco (use "NA" para as que não foram avaliadas).`,
      };
    }
  }

  const payload = {
    clinic_id: patient.clinic_id,
    patient_id: patientId,
    round,
    status: finalize ? "concluida" : "rascunho",
    assessment_date: assessmentDate,
    responses: responses as unknown as Json,
    results: results as unknown as Json,
    observations: observations ? String(observations) : null,
    updated_at: new Date().toISOString(),
  };

  if (assessmentId) {
    const { error } = await supabase.from("socially_savvy_assessments").update(payload).eq("id", assessmentId);
    if (error) {
      return {
        success: false,
        error: "Não foi possível salvar a avaliação — verifique sua permissão para este paciente e tente de novo.",
      };
    }
    revalidatePath(`/terapeuta/paciente/${patientId}/socially-savvy`);
    revalidatePath(`/terapeuta/paciente/${patientId}/socially-savvy/${assessmentId}`);
    return { success: true, id: assessmentId };
  }

  const { data: inserted, error } = await supabase
    .from("socially_savvy_assessments")
    .insert({ ...payload, assessed_by: user.id })
    .select("id")
    .single();
  if (error || !inserted) {
    // `unique (patient_id, round)` na migração 20260908010000: duas telas
    // abertas na mesma aplicação não criam registros concorrentes.
    const duplicate = error?.code === "23505";
    return {
      success: false,
      error: duplicate
        ? `A aplicação ${round} deste paciente já existe — abra-a no histórico em vez de criar outra.`
        : "Não foi possível criar a avaliação — verifique sua permissão para este paciente e tente de novo.",
    };
  }

  revalidatePath(`/terapeuta/paciente/${patientId}/socially-savvy`);
  return { success: true, id: inserted.id };
}
