import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

// Escala padrão de pontuação por marco (PRD §8/§9.4-A: "checklist por
// marco; pontuação por avaliação"), usada por protocolos licenciados sem
// escala própria configurada (protocols.scale = null). Protocolos genéricos
// semeados de lib/protocol-templates/ trazem sua própria escala (ex.:
// ABLLS-R/AFLS 0-4, COPM 1-10, SPM 1-4) — ver getProtocolScale().
export const ASSESSMENT_SCORE_LABEL: Record<number, string> = {
  0: "Não observado",
  1: "Emergente",
  2: "Adquirido",
};
export const ASSESSMENT_MAX_SCORE = 2;

export type ProtocolScale = { max: number; min: number; labels: Record<number, string> };

const DEFAULT_SCALE: ProtocolScale = { max: ASSESSMENT_MAX_SCORE, min: 0, labels: ASSESSMENT_SCORE_LABEL };

/**
 * Lê protocols.scale (jsonb) com fallback pra escala padrão 0/1/2. `min` é
 * 0 pra maioria dos instrumentos (checklists de marco) mas alguns templates
 * genéricos usam 1 (COPM 1-10, SPM 1-4 — ver lib/protocol-templates/).
 */
export function getProtocolScale(rawScale: unknown): ProtocolScale {
  if (!rawScale || typeof rawScale !== "object") return DEFAULT_SCALE;
  const s = rawScale as { max?: unknown; min?: unknown; labels?: unknown };
  if (typeof s.max !== "number" || !s.labels || typeof s.labels !== "object") return DEFAULT_SCALE;
  const labels: Record<number, string> = {};
  for (const [key, value] of Object.entries(s.labels as Record<string, unknown>)) {
    if (typeof value === "string") labels[Number(key)] = value;
  }
  const min = typeof s.min === "number" ? s.min : 0;
  return { max: s.max, min, labels };
}

export type ProtocolItemRow = {
  id: string;
  domain: string;
  level: string | null;
  itemCode: string;
  description: string;
  weight: number;
  inverted: boolean;
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
  isGeneric: boolean;
  scale: ProtocolScale;
  items: ProtocolItemRow[];
  assessments: AssessmentPoint[];
  domainTrends: DomainTrend[];
};

/**
 * % do domínio numa avaliação, considerando peso e inversão por item
 * (templates genéricos como DEMUCA e SPM usam ambos). O valor bruto é
 * normalizado pro intervalo [0, max-min] antes de somar — necessário pra
 * escalas que não começam em 0 (COPM 1-10, SPM 1-4). Itens invertidos
 * contam (faixa - normalizado) no numerador, então "pouco comportamento
 * restritivo" ou "pouca dificuldade sensorial" vira percentual alto, na
 * mesma direção dos demais domínios.
 */
function computeDomainTrends(items: ProtocolItemRow[], assessments: AssessmentPoint[], scale: ProtocolScale): DomainTrend[] {
  const domains = [...new Set(items.map((i) => i.domain))];
  const range = scale.max - scale.min;

  return domains
    .map((domain) => {
      const domainItems = items.filter((i) => i.domain === domain);
      const points = assessments
        .map((a) => {
          const scored = domainItems.filter((i) => a.scores[i.id] !== undefined);
          if (scored.length === 0 || range <= 0) return null;
          let earned = 0;
          let possible = 0;
          for (const item of scored) {
            const raw = a.scores[item.id] ?? scale.min;
            const normalized = Math.min(Math.max(raw - scale.min, 0), range);
            const value = item.inverted ? range - normalized : normalized;
            earned += value * item.weight;
            possible += range * item.weight;
          }
          const pct = possible > 0 ? Math.round((earned / possible) * 100) : 0;
          return { assessedAt: a.assessedAt, pct };
        })
        .filter((p): p is DomainTrendPoint => p !== null);
      return { domain, points };
    })
    .filter((d) => d.points.length > 0);
}

export type ProtocolOption = { id: string; name: string };

/**
 * Versão leve de `getPatientProtocolTabs`: só id/nome dos protocolos
 * cadastrados pela clínica (licenciados ou genéricos) com item visível ao
 * usuário atual, sem carregar itens/avaliações/tendências. Usada pra montar
 * os botões de escolha de protocolo no início da intervenção (evolução da
 * sessão), antes de entrar na tela de avaliação em si.
 */
export async function getPatientProtocolOptions(supabase: Supa, clinicId: string): Promise<ProtocolOption[]> {
  const { data: protocols } = await supabase
    .from("protocols")
    .select("id, name")
    .eq("clinic_id", clinicId)
    .order("name");
  const protocolList = protocols ?? [];
  if (protocolList.length === 0) return [];

  const { data: itemRows } = await supabase
    .from("protocol_items")
    .select("protocol_id")
    .in(
      "protocol_id",
      protocolList.map((p) => p.id),
    );
  const visibleIds = new Set((itemRows ?? []).map((i) => i.protocol_id));

  return protocolList.filter((p) => visibleIds.has(p.id));
}

/**
 * Protocolos da clínica (licenciados ou genéricos) com pelo menos um item
 * visível ao usuário atual (RLS de `protocol_items` já resolve certificação
 * — ex.: ESDM só aparece pra terapeuta certificado ou supervisor/gestor),
 * mais o histórico de avaliações do paciente e a evolução por domínio pra
 * cada um. Um protocolo sem item visível simplesmente não entra na lista de
 * abas.
 */
export async function getPatientProtocolTabs(
  supabase: Supa,
  clinicId: string,
  patientId: string,
): Promise<ProtocolTabData[]> {
  const { data: protocols } = await supabase
    .from("protocols")
    .select("id, name, is_generic, scale")
    .eq("clinic_id", clinicId)
    .order("name");
  const protocolList = protocols ?? [];
  if (protocolList.length === 0) return [];

  const protocolIds = protocolList.map((p) => p.id);

  const [{ data: itemRows }, { data: assessmentRows }] = await Promise.all([
    supabase
      .from("protocol_items")
      .select("id, protocol_id, domain, level, item_code, description, weight, inverted, sort_order")
      .in("protocol_id", protocolIds)
      .order("sort_order")
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
    list.push({
      id: i.id,
      domain: i.domain,
      level: i.level,
      itemCode: i.item_code,
      description: i.description,
      weight: i.weight ?? 1,
      inverted: i.inverted ?? false,
    });
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
      const scale = getProtocolScale(p.scale);
      return {
        id: p.id,
        name: p.name,
        isGeneric: p.is_generic ?? false,
        scale,
        items,
        assessments,
        domainTrends: computeDomainTrends(items, assessments, scale),
      };
    })
    .filter((p) => p.items.length > 0);
}
