/**
 * Estado atual da ficha a partir das entradas (append-only): a última entrada
 * de cada item vale; entradas anteriores ficam só no histórico.
 */
export interface PlaygroundEntryLike {
  kind: "item" | "evolution";
  protocolItemId: string | null;
  /** `null` = o item foi limpo pelo terapeuta (volta a "não observado"). */
  score: number | null;
  savedAt: string;
}

export function latestItemEntries<T extends PlaygroundEntryLike>(entries: T[]): Map<string, T> {
  const sorted = [...entries]
    .filter((e) => e.kind === "item" && e.protocolItemId)
    .sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
  const latest = new Map<string, T>();
  for (const e of sorted) latest.set(e.protocolItemId as string, e);
  return latest;
}

/**
 * Snapshot de `protocol_assessments.scores` na conclusão. Itens sem resposta
 * (nunca preenchidos ou limpos) ficam de fora: "não observado" não vira 0.
 */
export function buildSnapshotScores<T extends PlaygroundEntryLike>(entries: T[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [itemId, entry] of latestItemEntries(entries)) {
    if (entry.score !== null) scores[itemId] = entry.score;
  }
  return scores;
}
