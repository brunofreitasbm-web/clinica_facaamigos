// lib/balance-cell-pure.ts

/**
 * Célula de saldo do Financeiro HUB salva ao perder o foco. Só salva se o número mudou
 * em relação ao ÚLTIMO valor gravado (não ao valor com que a tela abriu: senão voltar ao
 * valor original depois de salvar outro nunca regrava). Campo vazio conta como 0.
 */
export function shouldSaveBalance(typed: string, lastSaved: number): boolean {
  const n = Number(typed === "" ? "0" : typed);
  return Number.isFinite(n) && n !== lastSaved;
}
