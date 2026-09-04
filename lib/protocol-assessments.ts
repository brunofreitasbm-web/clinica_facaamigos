import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

// Escala simplificada de pontuação por marco (PRD §8/§9.4-A: "checklist por
// marco; pontuação por avaliação"). VB-MAPP/ABLLS-R/ESDM usam rubricas
// próprias e mais granulares no instrumento original — esta é a
// transcrição simplificada já aceita na decisão de risco registrada, não
// uma reprodução fiel de nenhuma delas.
export const ASSESSMENT_SCORE_LABEL: Record<number, string> = {
  0: "Não observado",
  1: "Emergente",
  2: "Adquirido",
};
export const ASSESSMENT_MAX_SCORE = 2;

export type ProtocolItemRow = {
  id: string;
  domain: string;
  level: string | null;
  itemCode: string;
  description: string;
};

export type AssessmentPoint = {
  id: string;
  assessedAt: string;
  assessedByName: string;
  scores: Record<string, number>;
};

export type DomainTrendPoint = { assessedAt: string; pct: number };
export type DomainTrend = { domain: string; points: DomainTrendPoint[] };

export type ProtocolTabData = {
  id: string;
  name: string;
  items: ProtocolItemRow[];
  assessments: AssessmentPoint[];
  domainTrends: DomainTrend[];
};

function computeDomainTrends(items: ProtocolItemRow[], assessments: AssessmentPoint[]): DomainTrend[] {
  const domains = [...new Set(items.map((i) => i.domain))];

  return domains
    .map((domain) => {
      const domainItems = items.filter((i) => i.domain === domain);
      const points = assessments
        .map((a) => {
          const scored = domainItems.filter((i) => a.scores[i.id] !== undefined);
          if (scored.length === 0) return null;
          const total = scored.reduce((sum, i) => sum + (a.scores[i.id] ?? 0), 0);
          const pct = Math.round((total / (scored.length * ASSESSMENT_MAX_SCORE)) * 100);
          return { assessedAt: a.assessedAt, pct };
        })
        .filter((p): p is DomainTrendPoint => p !== null);
      return { domain, points };
    })
    .filter((d) => d.points.length > 0);
}

/**
 * Protocolos licenciados pela clínica com pelo menos um item visível ao
 * usuário atual (RLS de `protocol_items` já resolve certificação — ex.:
 * ESDM só aparece pra terapeuta certificado ou supervisor/gestor), mais o
 * histórico de avaliações do paciente e a evolução por domínio pra cada um.
 * Um protocolo sem item visível simplesmente não entra na lista de abas.
 */
export async function getPatientProtocolTabs(
  supabase: Supa,
  clinicId: string,
  patientId: string,
): Promise<ProtocolTabData[]> {
  const { data: protocols } = await supabase
    .from("protocols")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .order("name");
  const protocolList = protocols ?? [];
  if (protocolList.length === 0) return [];

  const protocolIds = protocolList.map((p) => p.id);

  const [{ data: itemRows }, { data: assessmentRows }] = await Promise.all([
    supabase
      .from("protocol_items")
      .select("id, protocol_id, domain, level, item_code, description")
      .in("protocol_id", protocolIds)
      .order("domain")
      .order("level")
      .order("item_code"),
    supabase
      .from("protocol_assessments")
      .select("id, protocol_id, assessed_at, scores, profiles!assessed_by(full_name)")
      .eq("patient_id", patientId)
      .in("protocol_id", protocolIds)
      .order("assessed_at", { ascending: true }),
  ]);

  const itemsByProtocol = new Map<string, ProtocolItemRow[]>();
  for (const i of itemRows ?? []) {
    const list = itemsByProtocol.get(i.protocol_id) ?? [];
    list.push({ id: i.id, domain: i.domain, level: i.level, itemCode: i.item_code, description: i.description });
    itemsByProtocol.set(i.protocol_id, list);
  }

  const assessmentsByProtocol = new Map<string, AssessmentPoint[]>();
  for (const a of assessmentRows ?? []) {
    const assessor = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
    const list = assessmentsByProtocol.get(a.protocol_id) ?? [];
    list.push({
      id: a.id,
      assessedAt: a.assessed_at,
      assessedByName: assessor?.full_name ?? "—",
      scores: (a.scores as Record<string, number>) ?? {},
    });
    assessmentsByProtocol.set(a.protocol_id, list);
  }

  return protocolList
    .map((p) => {
      const items = itemsByProtocol.get(p.id) ?? [];
      const assessments = assessmentsByProtocol.get(p.id) ?? [];
      return {
        id: p.id,
        name: p.name,
        items,
        assessments,
        domainTrends: computeDomainTrends(items, assessments),
      };
    })
    .filter((p) => p.items.length > 0);
}
