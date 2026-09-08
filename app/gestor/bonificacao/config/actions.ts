"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { METRIC_CATALOG, TARGET_ROLES, findMetricDef } from "@/lib/metric-catalog";
import {
  BONUS_MODULES,
  getActiveRuleSets,
  getRuleSetHistory,
  saveNewRuleSetVersion,
  type BonusModule,
  type RuleSetItemDraft,
  type RuleSetRow,
} from "@/lib/bonus-rules";
import { simulateBonusRuleSet, type SimResult } from "@/lib/bonus-simulation";

export type { RuleSetRow, RuleSetItemDraft, BonusModule };

export async function getBonusConfigData(): Promise<{
  roles: { value: Role; label: string }[];
  modules: typeof BONUS_MODULES;
  catalog: typeof METRIC_CATALOG;
  active: RuleSetRow[];
  history: RuleSetRow[];
}> {
  const supabase = await createClient();
  const [active, history] = await Promise.all([
    getActiveRuleSets(supabase, DEV_CLINIC_ID),
    getRuleSetHistory(supabase, DEV_CLINIC_ID),
  ]);

  return {
    roles: TARGET_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
    modules: BONUS_MODULES,
    catalog: METRIC_CATALOG,
    active,
    history,
  };
}

export async function saveBonusRuleSet(input: {
  role: string;
  module: BonusModule;
  validFrom: string;
  note: string;
  items: RuleSetItemDraft[];
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!TARGET_ROLES.includes(input.role as Role)) {
    return { success: false, error: "Cargo inválido." };
  }
  if (!BONUS_MODULES.some((m) => m.value === input.module)) {
    return { success: false, error: "Módulo inválido." };
  }
  if (!input.validFrom) {
    return { success: false, error: "Informe a data de início da vigência." };
  }

  const result = await saveNewRuleSetVersion(supabase, {
    clinicId: DEV_CLINIC_ID,
    role: input.role,
    module: input.module,
    validFrom: input.validFrom,
    note: input.note.trim() || null,
    createdBy: userData.user?.id ?? null,
    items: input.items,
  });

  if (!result.success) return result;

  await supabase.from("audit_log").insert({
    clinic_id: DEV_CLINIC_ID,
    actor_id: userData.user?.id ?? null,
    action: "INSERT",
    table_name: "bonus_rule_sets",
    row_id: result.id!,
    after: { role: input.role, module: input.module, valid_from: input.validFrom, items: input.items },
  });

  revalidatePath("/gestor/bonificacao/config");
  revalidatePath("/gestor/bonificacao");
  return { success: true };
}

export type SimulateInput = {
  role: string;
  items: RuleSetItemDraft[];
  periodStart: string;
  periodEnd: string;
  overrides: Record<string, number>;
};

export async function runBonusSimulation(input: SimulateInput): Promise<SimResult | { error: string }> {
  if (!TARGET_ROLES.includes(input.role as Role)) {
    return { error: "Cargo inválido." };
  }
  if (!input.periodStart || !input.periodEnd || input.periodStart >= input.periodEnd) {
    return { error: "Informe um período válido (início antes do fim)." };
  }
  const items = input.items.filter((i) => findMetricDef(input.role, i.metricKey) && i.weightPct > 0);
  if (items.length === 0) {
    return { error: "Selecione ao menos uma métrica com peso > 0." };
  }

  const supabase = await createClient();
  const periodStartISO = new Date(`${input.periodStart}T00:00:00.000Z`).toISOString();
  const periodEndISO = new Date(`${input.periodEnd}T00:00:00.000Z`).toISOString();

  return simulateBonusRuleSet(supabase, DEV_CLINIC_ID, input.role, items, periodStartISO, periodEndISO, input.overrides);
}
