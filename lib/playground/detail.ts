import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getProtocolScale } from "@/lib/protocol-assessments";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { computeVisitStatus, type PlaygroundVisitStatus } from "./status.ts";
import { latestItemEntries } from "./snapshot.ts";

type Supa = SupabaseClient<Database>;

export type PlaygroundDetailItem = {
  code: string;
  description: string;
  score: number;
  scoreLabel: string;
  authorName: string;
  authorSpecialty: string | null;
  visitNo: number | null;
  /** Quantas vezes o item foi corrigido (entradas depois da primeira). */
  revisions: number;
};

export type PlaygroundDetailSeries = {
  id: string;
  status: string;
  level: number;
  totalVisits: number;
  locationName: string;
  concludedAt: string | null;
  concludedByName: string | null;
  visits: {
    visitNo: number;
    scheduledStart: string;
    status: PlaygroundVisitStatus;
    entryCount: number;
    authors: string[];
  }[];
  domains: { domain: string; items: PlaygroundDetailItem[] }[];
  evolutions: { visitNo: number | null; text: string; authorName: string; authorSpecialty: string | null; savedAt: string }[];
};

/** Fichas do playground de um paciente, para o prontuário (somente leitura). */
export async function getPlaygroundDetail(supabase: Supa, patientId: string): Promise<PlaygroundDetailSeries[]> {
  const { data: seriesRows } = await supabase
    .from("playground_series")
    .select("*")
    .eq("patient_id", patientId)
    .in("status", ["liberada", "concluida"])
    .order("created_at", { ascending: false });
  const series = seriesRows ?? [];
  if (series.length === 0) return [];
  const seriesIds = series.map((s) => s.id);

  const [{ data: visitRows }, { data: entryRows }, { data: locationRows }, { data: protocolRows }] = await Promise.all([
    supabase.from("playground_visits").select("*").in("series_id", seriesIds).order("visit_no"),
    supabase.from("playground_entries").select("*").in("series_id", seriesIds).order("saved_at"),
    supabase.from("playground_locations").select("id, name").in("id", [...new Set(series.map((s) => s.location_id))]),
    supabase.from("protocols").select("id, scale").in("id", [...new Set(series.map((s) => s.protocol_id))]),
  ]);
  const visits = visitRows ?? [];
  const entries = entryRows ?? [];
  const itemIds = [...new Set(entries.map((e) => e.protocol_item_id).filter((i): i is string => !!i))];
  const { data: itemRows } = itemIds.length
    ? await supabase
        .from("protocol_items")
        .select("id, domain, item_code, description, sort_order")
        .in("id", itemIds)
        .order("sort_order")
    : { data: [] };
  const itemById = new Map((itemRows ?? []).map((i) => [i.id, i]));
  const locationById = new Map((locationRows ?? []).map((l) => [l.id, l.name]));
  const scaleByProtocol = new Map((protocolRows ?? []).map((p) => [p.id, getProtocolScale(p.scale)]));
  const now = new Date();

  return series.map((s) => {
    const own = entries.filter((e) => e.series_id === s.id);
    const ownVisits = visits.filter((v) => v.series_id === s.id);
    const visitNoById = new Map(ownVisits.map((v) => [v.id, v.visit_no]));
    const scale = scaleByProtocol.get(s.protocol_id);

    const latest = latestItemEntries(
      own.map((e) => ({
        kind: e.kind as "item" | "evolution",
        protocolItemId: e.protocol_item_id,
        score: e.score,
        savedAt: e.saved_at,
        entry: e,
      })),
    );
    const domains: PlaygroundDetailSeries["domains"] = [];
    const ordered = [...latest.values()]
      .filter((l) => l.score !== null && itemById.has(l.protocolItemId as string))
      .sort((a, b) => (itemById.get(a.protocolItemId!)?.sort_order ?? 0) - (itemById.get(b.protocolItemId!)?.sort_order ?? 0));
    for (const l of ordered) {
      const item = itemById.get(l.protocolItemId as string)!;
      let group = domains.find((d) => d.domain === item.domain);
      if (!group) {
        group = { domain: item.domain, items: [] };
        domains.push(group);
      }
      const score = l.score as number;
      group.items.push({
        code: item.item_code,
        description: item.description,
        score,
        scoreLabel: scale?.labels[score] ?? String(score),
        authorName: l.entry.author_name_snapshot,
        authorSpecialty: l.entry.author_specialty_snapshot,
        visitNo: visitNoById.get(l.entry.visit_id) ?? null,
        revisions: own.filter((e) => e.kind === "item" && e.protocol_item_id === l.protocolItemId).length - 1,
      });
    }

    return {
      id: s.id,
      status: s.status,
      level: s.level,
      totalVisits: s.total_visits,
      locationName: locationById.get(s.location_id) ?? "",
      concludedAt: s.concluded_at,
      concludedByName: s.concluded_by_name,
      visits: ownVisits
        .filter((v) => !v.cancelled_at)
        .map((v) => {
          const visitEntries = own.filter((e) => e.visit_id === v.id);
          return {
            visitNo: v.visit_no,
            scheduledStart: v.scheduled_start,
            status: computeVisitStatus(
              {
                scheduledStart: v.scheduled_start,
                durationMin: v.duration_min,
                arrivedAt: v.arrived_at,
                leftAt: v.left_at,
                cancelledAt: v.cancelled_at,
                firstEntryAt: visitEntries[0]?.saved_at ?? null,
              },
              now,
              CLINIC_TIMEZONE,
            ),
            entryCount: visitEntries.length,
            authors: [...new Set(visitEntries.map((e) => e.author_name_snapshot))],
          };
        }),
      domains,
      evolutions: own
        .filter((e) => e.kind === "evolution" && e.text)
        .map((e) => ({
          visitNo: visitNoById.get(e.visit_id) ?? null,
          text: e.text as string,
          authorName: e.author_name_snapshot,
          authorSpecialty: e.author_specialty_snapshot,
          savedAt: e.saved_at,
        })),
    };
  });
}
