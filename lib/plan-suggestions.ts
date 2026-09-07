import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getPatientProtocolTabs } from "@/lib/protocol-assessments";
import { findProtocolCatalogEntry } from "@/lib/protocol-catalog";

type Supa = SupabaseClient<Database>;

export type SuggestedGoal = {
  key: string;
  discipline: string;
  domain: string;
  description: string;
  baseline: string;
  protocolLabel: string;
  /**
   * Itens do protocolo por trás desta sugestão (score < 2 na última
   * avaliação) — cada um vira candidato a virar um `programs` (coleta de
   * dados por tentativa) quando a meta for de disciplina 'aba'. Ver
   * app/supervisao/planos/novo/plan-form.tsx e actions.ts::createTreatmentPlan.
   */
  pendingItems: { id: string; itemCode: string; description: string }[];
};

export type TeamSuggestion = { discipline: string; roleLabel: string; profileName: string };

/**
 * "Montar PEI" a partir da avaliação já aplicada — Módulo 3 MAAIS, slide 27
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

    const domains = [...new Set(tab.items.map((i) => i.domain))];
    for (const domain of domains) {
      const domainItems = tab.items.filter((i) => i.domain === domain);
      const pending = domainItems.filter((i) => (latest.scores[i.id] ?? 0) < 2);
      if (pending.length === 0) continue;

      const emergentCount = pending.filter((i) => latest.scores[i.id] === 1).length;
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
        pendingItems: pending.map((i) => ({ id: i.id, itemCode: i.itemCode, description: i.description })),
      });
    }
  }

  return suggestions;
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
