import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type ProgramDefault = {
  name: string;
  targetType: "tentativa" | "duracao" | "frequencia" | "tarefa";
  masteryCriterion: string;
};

export type PtsTemplate = {
  id: string;
  clinic_id: string;
  discipline: string;
  domain: string;
  title: string;
  description: string;
  baseline: string | null;
  strategy: string | null;
  criterion: string | null;
  horizon: "curto" | "medio" | "longo" | null;
  methodology: "dtt" | "naturalistico" | "misto" | "outra" | null;
  programs_default: ProgramDefault[];
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Busca templates de PTS ativos da clínica, opcionalmente filtrados por disciplina e busca livre.
 */
export async function getPtsTemplates(
  supabase: SupabaseClient<Database>,
  opts: { discipline?: string; search?: string; activeOnly?: boolean } = {}
): Promise<PtsTemplate[]> {
  let query = (supabase as any)
    .from("pts_templates")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (opts.activeOnly !== false) {
    query = query.eq("active", true);
  }

  if (opts.discipline) {
    query = query.eq("discipline", opts.discipline);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Erro ao buscar pts_templates:", error);
    return [];
  }

  let results: PtsTemplate[] = data.map((item: any) => ({
    ...item,
    programs_default: Array.isArray(item.programs_default) ? item.programs_default : [],
  }));

  if (opts.search && opts.search.trim()) {
    const q = opts.search.toLowerCase().trim();
    results = results.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.domain.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.strategy && t.strategy.toLowerCase().includes(q))
    );
  }

  return results;
}

/**
 * Extrai sugestões únicas para os datalists de autocomplete (Domínio, Linha de Base, Estratégia)
 */
export function extractAutocompleteSuggestions(templates: PtsTemplate[]) {
  const domains = Array.from(new Set(templates.map((t) => t.domain.trim()).filter(Boolean)));
  const baselines = Array.from(new Set(templates.map((t) => t.baseline?.trim()).filter((b): b is string => !!b)));
  const strategies = Array.from(new Set(templates.map((t) => t.strategy?.trim()).filter((s): s is string => !!s)));

  return { domains, baselines, strategies };
}
