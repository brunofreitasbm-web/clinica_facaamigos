import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getPatientProtocolTabs } from "@/lib/protocol-assessments";
import { findProtocolCatalogEntry } from "@/lib/protocol-catalog";
import { getLatestConcludedByInstrument } from "@/lib/fono-assessments";
import {
  computeAdlResults,
  computeProcResults,
  classifyLanguage,
  getFonoBands,
  getFonoScaleLabels,
  ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY,
  FONO_INSTRUMENT_LABEL,
  PROC_CATALOG,
  type AdlManualScores,
  type AdlResponses,
  type ProcResponses,
} from "@/lib/fono-instruments";
import { getLatestConcludedSociallySavvy } from "@/lib/socially-savvy-assessments";
import { SOCIALLY_SAVVY_CATALOG, SOCIALLY_SAVVY_LABEL, computeSociallySavvyResults } from "@/lib/socially-savvy";

type Supa = SupabaseClient<Database>;

export type SuggestedGoal = {
  key: string;
  discipline: string;
  domain: string;
  description: string;
  baseline: string;
  protocolLabel: string;
  /**
   * Itens por trás desta sugestão (ainda não adquiridos na última avaliação)
   * — cada um vira candidato a virar um `programs` (coleta de dados por
   * tentativa) quando a meta for de disciplina 'aba'. Ver
   * app/supervisao/planos/novo/plan-form.tsx e actions.ts::createTreatmentPlan.
   *
   * `protocolItemId` só é preenchido quando o item vem mesmo de
   * `protocol_items` (protocolo licenciado cadastrado pelo gestor) — é uma FK
   * e um id inventado quebraria o insert. Instrumentos com catálogo fixo em
   * código (fono, Socially Savvy) mandam `null`, e aí o servidor grava o
   * programa contra o `domain_taxonomy` da dupla disciplina+domínio,
   * criando-o se ainda não existir (actions.ts::resolveDomainTaxonomyId).
   */
  pendingItems: { protocolItemId: string | null; itemCode: string; description: string }[];
};

export type TeamSuggestion = { discipline: string; roleLabel: string; profileName: string };

/**
 * "Montar PTS" a partir da avaliação já aplicada — Módulo 3 MAAIS, slide 27
 * ("Análise dos dados e construção do PDI: compilação dos dados das
 * avaliações"). Em vez de o supervisor começar do zero, cada domínio do
 * protocolo com itens ainda não adquiridos (score < 2, ou nunca pontuado)
 * vira uma sugestão de meta pronta pra revisar e ajustar no formulário.
 */
export async function getSuggestedGoals(
  supabase: Supa,
  clinicId: string,
  patientId: string,
): Promise<SuggestedGoal[]> {
  const tabs = await getPatientProtocolTabs(supabase, clinicId, patientId);
  const suggestions: SuggestedGoal[] = [];

  for (const tab of tabs) {
    if (tab.assessments.length === 0) continue;
    const latest = tab.assessments[tab.assessments.length - 1];
    const catalogEntry = findProtocolCatalogEntry(tab.name);
    const protocolLabel = catalogEntry?.displayName ?? tab.name;
    const discipline = catalogEntry?.discipline ?? "outra";

    const scaleMax = tab.scale.max;
    const domains = [...new Set(tab.items.map((i) => i.domain))];
    for (const domain of domains) {
      const domainItems = tab.items.filter((i) => i.domain === domain);
      const pending = domainItems.filter((i) => (latest.scores[i.id] ?? 0) < scaleMax);
      if (pending.length === 0) continue;

      const emergentCount = pending.filter((i) => {
        const score = latest.scores[i.id] ?? 0;
        return score > 0 && score < scaleMax;
      }).length;
      const notObservedCount = pending.length - emergentCount;
      const sample = pending
        .slice(0, 3)
        .map((i) => i.description)
        .join("; ");

      suggestions.push({
        key: `${tab.id}-${domain}`,
        discipline,
        domain,
        description: `${sample}${pending.length > 3 ? "…" : ""}`,
        baseline: `${pending.length} de ${domainItems.length} itens não adquiridos (${emergentCount} emergentes, ${notObservedCount} não observados) — ${protocolLabel}`,
        protocolLabel,
        pendingItems: pending.map((i) => ({
          protocolItemId: i.id,
          itemCode: i.itemCode,
          description: i.description,
        })),
      });
    }
  }

  suggestions.push(...(await getFonoSuggestedGoals(supabase, patientId)));
  suggestions.push(...(await getSociallySavvySuggestedGoals(supabase, patientId)));

  return suggestions;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Mesma ideia de `getSuggestedGoals` acima, só que a partir das avaliações
 * de fonoaudiologia (ADL, ADL-2, PROC — lib/fono-instruments/), que não
 * passam por `protocol_assessments`. Reproduz a lógica da aba "PEI" das
 * planilhas: cada item marcado como erro ("0") vira um item pendente,
 * agrupado por escala (Receptiva/Compreensiva e Expressiva). `pendingItems`
 * usa a chave do catálogo do instrumento como `id` — não é um
 * `protocol_items.id`, então `discipline: "fonoaudiologia"` nunca cai no
 * branch de `programs` de ABA em app/supervisao/planos/novo/plan-form.tsx
 * (que só é acionado para `discipline === "aba"`).
 */
async function getFonoSuggestedGoals(supabase: Supa, patientId: string): Promise<SuggestedGoal[]> {
  const latestByInstrument = await getLatestConcludedByInstrument(supabase, patientId);
  const suggestions: SuggestedGoal[] = [];

  for (const instrument of ["adl", "adl2"] as const) {
    const assessment = latestByInstrument[instrument];
    if (!assessment) continue;

    const bands = getFonoBands(instrument);
    const { receptive: receptiveLabel, expressive: expressiveLabel } = getFonoScaleLabels(instrument);
    const manual = assessment.manualScores as unknown as AdlManualScores;
    const result = computeAdlResults(bands, assessment.responses as AdlResponses, manual, {
      doubleCountExpressiveBandKey: instrument === "adl" ? ADL_DOUBLE_COUNT_EXPRESSIVE_BAND_KEY : undefined,
    });
    const protocolLabel = `${FONO_INSTRUMENT_LABEL[instrument]} — ${fmtDate(assessment.testDate)}`;
    const classification = classifyLanguage(manual.escorePadraoGlobal);
    const scoreSummary = `Escore bruto ${result.escoreBrutoGlobal ?? "—"}, EP global ${manual.escorePadraoGlobal ?? "—"}${classification ? ` (${classification})` : ""}`;

    const scales: [string, typeof result.objetivosPrioritariosReceptivo][] = [
      [receptiveLabel, result.objetivosPrioritariosReceptivo],
      [expressiveLabel, result.objetivosPrioritariosExpressivo],
    ];
    for (const [scaleLabel, items] of scales) {
      if (items.length === 0) continue;
      const sample = items
        .slice(0, 3)
        .map((i) => i.text)
        .join("; ");
      suggestions.push({
        key: `fono-${instrument}-${assessment.id}-${scaleLabel}`,
        discipline: "fonoaudiologia",
        domain: scaleLabel,
        description: `${sample}${items.length > 3 ? "…" : ""}`,
        baseline: `${scoreSummary} — ${protocolLabel}`,
        protocolLabel,
        pendingItems: items.map((i) => ({ protocolItemId: null, itemCode: String(i.num), description: i.text })),
      });
    }
  }

  const proc = latestByInstrument.proc;
  if (proc) {
    const procResult = computeProcResults(PROC_CATALOG, proc.responses as ProcResponses);
    const protocolLabel = `${FONO_INSTRUMENT_LABEL.proc} — ${fmtDate(proc.testDate)}`;
    for (const section of procResult.sections) {
      if (section.score >= section.max) continue;
      suggestions.push({
        key: `fono-proc-${proc.id}-${section.key}`,
        discipline: "fonoaudiologia",
        domain: section.label,
        description: section.subsections
          .filter((s) => s.score < s.max)
          .slice(0, 3)
          .map((s) => s.label)
          .join("; "),
        baseline: `${section.score}/${section.max} pontos — ${protocolLabel}`,
        protocolLabel,
        pendingItems: [],
      });
    }
  }

  return suggestions;
}

/**
 * Sugestões vindas do Socially Savvy (lib/socially-savvy/), que também não
 * passa por `protocol_assessments`. Reproduz a aba "PEI" da planilha: uma meta
 * por área com objetivos prioritários (habilidades pontuadas com 2 —
 * emergentes), a partir da última aplicação concluída.
 *
 * Cada habilidade prioritária vira um `pendingItem` com `protocolItemId: null`
 * — os códigos do catálogo (JA01, SP01…) não são `protocol_items.id`. Como a
 * disciplina é 'aba', plan-form.tsx já transforma cada um num programa de
 * coleta por tentativa, e o servidor o grava contra o `domain_taxonomy` da
 * área. Sem isso o PEI viraria só texto de meta, sem nada para a terapeuta
 * registrar sessão a sessão.
 */
async function getSociallySavvySuggestedGoals(supabase: Supa, patientId: string): Promise<SuggestedGoal[]> {
  const assessment = await getLatestConcludedSociallySavvy(supabase, patientId);
  if (!assessment) return [];

  const results = computeSociallySavvyResults(SOCIALLY_SAVVY_CATALOG, assessment.responses);
  const protocolLabel = `${SOCIALLY_SAVVY_LABEL} — aplicação ${assessment.round}, ${fmtDate(assessment.assessmentDate)}`;

  return results.areas.flatMap((area) => {
    const priorities = results.priorityObjectives.filter((o) => o.areaKey === area.key);
    if (priorities.length === 0) return [];

    const sample = priorities
      .slice(0, 3)
      .map((o) => o.text)
      .join("; ");
    const others = results.otherObjectives.filter((o) => o.areaKey === area.key).length;

    return [
      {
        key: `socially-savvy-${assessment.id}-${area.key}`,
        discipline: "aba",
        domain: area.label,
        description: `${sample}${priorities.length > 3 ? "…" : ""}`,
        baseline: `${area.achieved}/${area.expected} pontos (${(area.percent * 100).toFixed(1).replace(".", ",")}%) · ${priorities.length} objetivos prioritários e ${others} demais objetivos — ${protocolLabel}`,
        protocolLabel,
        pendingItems: priorities.map((o) => ({
          protocolItemId: null,
          itemCode: o.code,
          description: o.text,
        })),
      },
    ];
  });
}

/** Equipe de avaliação já definida (Módulo 3 MAAIS, slide 23) — pré-marca as disciplinas do plano. */
export async function getTeamSuggestions(supabase: Supa, patientId: string): Promise<TeamSuggestion[]> {
  const { data } = await supabase
    .from("patient_access")
    .select("role_in_team, discipline, profiles!profile_id(full_name)")
    .eq("patient_id", patientId)
    .eq("access_type", "terapeuta")
    .not("role_in_team", "is", null)
    .is("revoked_at", null);

  return (data ?? [])
    .filter((r) => r.discipline)
    .map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        discipline: r.discipline as string,
        roleLabel: r.role_in_team === "supervisor_area" ? "Supervisor de área" : "Terapeuta avaliador",
        profileName: profile?.full_name ?? "—",
      };
    });
}
