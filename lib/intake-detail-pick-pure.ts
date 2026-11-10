// lib/intake-detail-pick-pure.ts
// Escolhe, na lista já consolidada, o caso pedido pelo detalhe. PURO, sem import com alias `@/`.

export function pickConsolidatedDraft<T extends { id: string }>(consolidated: T[], draftId: string): T | null {
  return consolidated.find((d) => d.id === draftId) ?? null;
}
