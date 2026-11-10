// lib/intake-detail-pick-pure.ts
// Escolhe, na lista já consolidada, o caso pedido pelo detalhe. PURO, sem import com alias `@/`.

export function pickConsolidatedDraft<T extends { id: string }>(consolidated: T[], draftId: string): T | null {
  return consolidated.find((d) => d.id === draftId) ?? null;
}

/**
 * Quais rascunhos a leitura da fila pega.
 * - Fila inteira (sem ids): só os ativos (não rejeitados; em triagem/autorização ou devolvidos).
 * - Por ids (detalhe da Fila): exatamente os ids que a lista mesclou no caso, SEM o filtro de ativos. Depois
 *   da mescla gravada em segundo plano os secundários ficam "rejected"; filtrá-los faria o detalhe consolidar
 *   só o principal e divergir da lista (guia enviada, cobranças, contagem de conversas).
 */
export function draftReadFilters(onlyIds?: string[]): { ids: string[] | null; activeOnly: boolean } {
  return onlyIds ? { ids: onlyIds, activeOnly: false } : { ids: null, activeOnly: true };
}
