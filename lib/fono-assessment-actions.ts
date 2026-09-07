"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chronologicalAge } from "@/lib/age";
import type { Json } from "@/lib/database.types";
import {
  isFonoInstrument,
  getFonoBands,
  computeAdlResults,
  computeFonologiaResults,
  computeProcResults,
  classifyLanguage,
  PROC_CATALOG,
  FONOLOGIA_WORDS,
  FONOLOGIA_BANDS,
  ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY,
  type FonoInstrument,
  type AdlManualScores,
  type AdlResponses,
  type FonologiaResponses,
  type ProcResponses,
} from "@/lib/fono-instruments";

// Shape local, não compartilhado com lib/protocol-assessment-actions.ts: o
// `ActionResult` de lá não é exportado e não carrega `id` (precisamos do id
// pra navegar até /terapeuta/paciente/[id]/fono/[instrument]/[assessmentId]
// depois de salvar).
export type FonoActionResult = { success: true; id: string } | { success: false; error: string };

function parseResponses(raw: FormDataEntryValue | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(String(raw));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === "string" && (typeof v === "string" || typeof v === "number")) out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

function parseManualScores(raw: FormDataEntryValue | null): AdlManualScores {
  const empty: AdlManualScores = {
    ultimaTarefaCorretaReceptiva: null,
    ultimaTarefaCorretaExpressiva: null,
    escorePadraoReceptivo: null,
    escorePadraoExpressivo: null,
    escorePadraoGlobal: null,
  };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(String(raw));
    if (typeof parsed !== "object" || parsed === null) return empty;
    const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      ultimaTarefaCorretaReceptiva: num((parsed as Record<string, unknown>).ultimaTarefaCorretaReceptiva),
      ultimaTarefaCorretaExpressiva: num((parsed as Record<string, unknown>).ultimaTarefaCorretaExpressiva),
      escorePadraoReceptivo: num((parsed as Record<string, unknown>).escorePadraoReceptivo),
      escorePadraoExpressivo: num((parsed as Record<string, unknown>).escorePadraoExpressivo),
      escorePadraoGlobal: num((parsed as Record<string, unknown>).escorePadraoGlobal),
    };
  } catch {
    return empty;
  }
}

/**
 * Restringe as respostas recebidas às chaves realmente pertencentes ao
 * catálogo do instrumento — mesma cautela de `app/terapeuta/evolucao/
 * actions.ts` (que revalida o corpo da evolução contra o catálogo de
 * comportamentos do servidor em vez de confiar no que o cliente mandou).
 * Chaves desconhecidas são descartadas silenciosamente em vez de rejeitar o
 * salvamento inteiro — um rascunho não deve travar por um resquício de
 * estado antigo no formulário.
 */
function sanitizeResponses(instrument: FonoInstrument, raw: Record<string, string>): Record<string, string> {
  const allowedKeys = new Set<string>();

  if (instrument === "adl" || instrument === "adl2") {
    for (const band of getFonoBands(instrument)) {
      for (const item of band.receptive) allowedKeys.add(item.key);
      for (const item of band.expressive) allowedKeys.add(item.key);
    }
    if (instrument === "adl2") {
      for (const word of FONOLOGIA_WORDS) allowedKeys.add(`fono-${word.number}`);
    }
  } else {
    for (const section of PROC_CATALOG) {
      for (const sub of section.subsections) {
        for (const item of sub.items) allowedKeys.add(`${sub.key}-${item.key}`);
      }
    }
    // Checklists "Características gerais" (não pontuados) — chave livre por
    // checklist, validada só quanto ao prefixo aqui; o valor é texto livre.
    allowedKeys.add("__general_checklists__");
  }

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (allowedKeys.has(k) || k.startsWith("gc-")) out[k] = v;
  }
  return out;
}

const ADL_VALID_VALUES = new Set(["1", "0", "NR"]);
const FONOLOGIA_VALID_VALUES = new Set(["+", "-", "N", "R", "NR"]);

function extractAdlResponses(sanitized: Record<string, string>): AdlResponses {
  const out: AdlResponses = {};
  for (const [k, v] of Object.entries(sanitized)) {
    if (!k.startsWith("fono-") && ADL_VALID_VALUES.has(v)) out[k] = v as AdlResponses[string];
  }
  return out;
}

function extractFonologiaResponses(sanitized: Record<string, string>): FonologiaResponses {
  const out: FonologiaResponses = {};
  for (const [k, v] of Object.entries(sanitized)) {
    if (k.startsWith("fono-") && FONOLOGIA_VALID_VALUES.has(v)) {
      out[k.slice("fono-".length)] = v as FonologiaResponses[string];
    }
  }
  return out;
}

export async function saveFonoAssessment(
  patientId: string,
  instrumentRaw: string,
  assessmentId: string | null,
  formData: FormData,
): Promise<FonoActionResult> {
  if (!isFonoInstrument(instrumentRaw)) {
    return { success: false, error: "Instrumento inválido." };
  }
  const instrument = instrumentRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const testDate = String(formData.get("test_date") ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
    return { success: false, error: "Informe a data do teste." };
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("id, clinic_id, birth_date")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) return { success: false, error: "Paciente não encontrado ou sem permissão de acesso." };

  const age = chronologicalAge(patient.birth_date, testDate);
  const rawResponses = sanitizeResponses(instrument, parseResponses(formData.get("responses")));
  const manual = parseManualScores(formData.get("manual_scores"));
  const observations = formData.get("observations");
  const finalize = formData.get("finalize") === "1";

  let results: Record<string, unknown>;

  if (instrument === "adl" || instrument === "adl2") {
    const bands = getFonoBands(instrument);
    const adlResponses = extractAdlResponses(rawResponses);
    const adlResults = computeAdlResults(bands, adlResponses, manual, {
      doubleCountExpressiveBandKey: instrument === "adl" ? ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY : undefined,
    });

    if (finalize) {
      if (
        manual.ultimaTarefaCorretaReceptiva === null ||
        manual.ultimaTarefaCorretaExpressiva === null ||
        manual.escorePadraoReceptivo === null ||
        manual.escorePadraoExpressivo === null ||
        manual.escorePadraoGlobal === null
      ) {
        return {
          success: false,
          error: "Para concluir, preencha a última tarefa correta e os escores padrão (consulte a tabela do manual).",
        };
      }
    }

    results = { ...adlResults };
    if (instrument === "adl2") {
      const fonologiaResponses = extractFonologiaResponses(rawResponses);
      results.fonologia = computeFonologiaResults(FONOLOGIA_WORDS, FONOLOGIA_BANDS, fonologiaResponses);
    }
  } else {
    const procResponses: ProcResponses = rawResponses;
    results = { ...computeProcResults(PROC_CATALOG, procResponses) };
  }

  const payload = {
    clinic_id: patient.clinic_id,
    patient_id: patientId,
    instrument,
    status: finalize ? "concluida" : "rascunho",
    test_date: testDate,
    birth_date: patient.birth_date,
    age_years: age.years,
    age_months: age.months,
    responses: rawResponses as unknown as Json,
    manual_scores: manual as unknown as Json,
    results: results as unknown as Json,
    observations: observations ? String(observations) : null,
    updated_at: new Date().toISOString(),
  };

  if (assessmentId) {
    const { error } = await supabase.from("fono_assessments").update(payload).eq("id", assessmentId);
    if (error) {
      return {
        success: false,
        error: "Não foi possível salvar a avaliação — verifique sua permissão para este paciente e tente de novo.",
      };
    }
    revalidatePath(`/terapeuta/paciente/${patientId}/fono`);
    revalidatePath(`/terapeuta/paciente/${patientId}/fono/${instrument}/${assessmentId}`);
    return { success: true, id: assessmentId };
  }

  const { data: inserted, error } = await supabase
    .from("fono_assessments")
    .insert({ ...payload, assessed_by: user.id })
    .select("id")
    .single();
  if (error || !inserted) {
    return {
      success: false,
      error: "Não foi possível criar a avaliação — verifique sua permissão para este paciente e tente de novo.",
    };
  }

  revalidatePath(`/terapeuta/paciente/${patientId}/fono`);
  return { success: true, id: inserted.id };
}

// Reexportado para as telas de resultado calcularem a classificação a
// partir do EP global digitado sem duplicar a tabela de faixas.
export { classifyLanguage };
