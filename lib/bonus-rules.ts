import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { findMetricDef } from "@/lib/metric-catalog";

type Supa = SupabaseClient<Database>;

export type BonusModule = "plr" | "bonificacao" | "faixa_pj";
export const BONUS_MODULES: { value: BonusModule; label: string }[] = [
  { value: "plr", label: "PLR (CLT semestral — Lei 10.101/2000)" },
  { value: "bonificacao", label: "Bonificação variável" },
  { value: "faixa_pj", label: "Progressão de faixa PJ" },
];

export type RuleSetItemDraft = {
  metricKey: string;
  weightPct: number;
  targetValue: number;
  eliminatory: boolean;
};

export type RuleSetRow = {
  id: string;
  role: string;
  module: BonusModule;
  validFrom: string;
  validTo: string | null;
  note: string | null;
  createdAt: string;
  createdByName: string | null;
  items: RuleSetItemDraft[];
  totalWeight: number;
};

/** Vigência aberta atual (valid_to is null) de cada cargo/módulo. */
export async function getActiveRuleSets(supabase: Supa, clinicId: string): Promise<RuleSetRow[]> {
  const { data: sets } = await supabase
    .from("bonus_rule_sets")
    .select("id, role, module, valid_from, valid_to, note, created_at, created_by, profiles:created_by(full_name)")
    .eq("clinic_id", clinicId)
    .is("valid_to", null)
    .order("role");

  return mapRuleSets(supabase, sets ?? []);
}

/** Histórico completo (todas as vigências, fechadas e aberta) por cargo/módulo. */
export async function getRuleSetHistory(supabase: Supa, clinicId: string): Promise<RuleSetRow[]> {
  const { data: sets } = await supabase
    .from("bonus_rule_sets")
    .select("id, role, module, valid_from, valid_to, note, created_at, created_by, profiles:created_by(full_name)")
    .eq("clinic_id", clinicId)
    .order("role")
    .order("valid_from", { ascending: false });

  return mapRuleSets(supabase, sets ?? []);
}

async function mapRuleSets(
  supabase: Supa,
  sets: {
    id: string;
    role: string;
    module: string;
    valid_from: string;
    valid_to: string | null;
    note: string | null;
    created_at: string;
    created_by: string | null;
    profiles: { full_name: string } | { full_name: string }[] | null;
  }[],
): Promise<RuleSetRow[]> {
  if (sets.length === 0) return [];
  const ids = sets.map((s) => s.id);
  const { data: items } = await supabase
    .from("bonus_rule_set_items")
    .select("rule_set_id, metric_key, weight_pct, target_value, eliminatory")
    .in("rule_set_id", ids);

  const itemsBySet = new Map<string, RuleSetItemDraft[]>();
  for (const it of items ?? []) {
    const list = itemsBySet.get(it.rule_set_id) ?? [];
    list.push({
      metricKey: it.metric_key,
      weightPct: Number(it.weight_pct),
      targetValue: Number(it.target_value),
      eliminatory: it.eliminatory,
    });
    itemsBySet.set(it.rule_set_id, list);
  }

  return sets.map((s) => {
    const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    const setItems = itemsBySet.get(s.id) ?? [];
    return {
      id: s.id,
      role: s.role,
      module: s.module as BonusModule,
      validFrom: s.valid_from,
      validTo: s.valid_to,
      note: s.note,
      createdAt: s.created_at,
      createdByName: profile?.full_name ?? null,
      items: setItems,
      totalWeight: setItems.reduce((sum, i) => sum + i.weightPct, 0),
    };
  });
}

export type SaveRuleSetInput = {
  clinicId: string;
  role: string;
  module: BonusModule;
  validFrom: string;
  note: string | null;
  createdBy: string | null;
  items: RuleSetItemDraft[];
};

/**
 * Publica uma nova vigência: fecha a aberta anterior (mesmo cargo/módulo)
 * em `validFrom` (ou no dia anterior, se já vigente antes) e insere a nova
 * com os itens. Nunca sobrescreve uma vigência já existente — é sempre um
 * novo registro, preservando o histórico do que valia em cada apuração
 * (§10.6 do PRD: memória de cálculo auditável).
 */
export async function saveNewRuleSetVersion(
  supabase: Supa,
  input: SaveRuleSetInput,
): Promise<{ success: boolean; error?: string; id?: string }> {
  if (input.items.length === 0) {
    return { success: false, error: "Inclua ao menos uma métrica." };
  }
  const totalWeight = input.items.reduce((sum, i) => sum + i.weightPct, 0);
  if (totalWeight > 100.01) {
    return { success: false, error: `A soma dos pesos (${totalWeight.toFixed(1)}%) não pode passar de 100%.` };
  }
  for (const item of input.items) {
    if (!findMetricDef(input.role, item.metricKey)) {
      return { success: false, error: `Métrica "${item.metricKey}" não existe para o cargo selecionado.` };
    }
    if (!(item.weightPct > 0 && item.weightPct <= 100)) {
      return { success: false, error: "Peso precisa ser entre 0 e 100 para cada métrica." };
    }
  }

  const dayBefore = new Date(input.validFrom);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const closeAt = dayBefore.toISOString().slice(0, 10);

  const { error: closeError } = await supabase
    .from("bonus_rule_sets")
    .update({ valid_to: closeAt })
    .eq("clinic_id", input.clinicId)
    .eq("role", input.role)
    .eq("module", input.module)
    .is("valid_to", null);

  if (closeError) {
    return { success: false, error: "Não foi possível fechar a vigência anterior." };
  }

  const { data: newSet, error: insertError } = await supabase
    .from("bonus_rule_sets")
    .insert({
      clinic_id: input.clinicId,
      role: input.role,
      module: input.module,
      valid_from: input.validFrom,
      note: input.note,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (insertError || !newSet) {
    return { success: false, error: "Não foi possível gravar a nova configuração." };
  }

  const { error: itemsError } = await supabase.from("bonus_rule_set_items").insert(
    input.items.map((item) => ({
      rule_set_id: newSet.id,
      metric_key: item.metricKey,
      weight_pct: item.weightPct,
      target_value: item.targetValue,
      eliminatory: item.eliminatory,
    })),
  );

  if (itemsError) {
    return { success: false, error: "Configuração criada, mas falhou ao gravar as métricas. Revise e salve de novo." };
  }

  return { success: true, id: newSet.id };
}
