// lib/signature-image-pure.ts
//
// Assinatura escaneada/fotografada → tinta preta com fundo transparente.
// Sem imports com alias `@/` (testável com `node --test`).

/** Papel claro some, tinta escura fica opaca; entre os dois, transição suave. */
export function inkAlpha(gray: number, paper = 165, ink = 70): number {
  if (gray >= paper) return 0;
  if (gray <= ink) return 255;
  return Math.round(((paper - gray) / (paper - ink)) * 255);
}

/**
 * Caixa que contém a tinta, com margem; null se não há tinta. Linhas e colunas
 * com poucos pontos (sujeira de escaneamento) não contam para o recorte.
 */
export function inkBounds(
  alpha: Uint8Array,
  width: number,
  height: number,
  margin = 6,
  minPerLine = Math.max(3, Math.round(Math.min(width, height) * 0.004)),
): { left: number; top: number; width: number; height: number } | null {
  const rows = new Uint32Array(height);
  const cols = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 40) {
        rows[y]++;
        cols[x]++;
      }
    }
  }
  const first = (a: Uint32Array) => a.findIndex((n) => n >= minPerLine);
  const last = (a: Uint32Array) => {
    for (let i = a.length - 1; i >= 0; i--) if (a[i] >= minPerLine) return i;
    return -1;
  };
  const y0 = first(rows), y1 = last(rows), x0 = first(cols), x1 = last(cols);
  if (y0 < 0 || x0 < 0) return null;
  const left = Math.max(0, x0 - margin);
  const top = Math.max(0, y0 - margin);
  return {
    left,
    top,
    width: Math.min(width, x1 + margin + 1) - left,
    height: Math.min(height, y1 + margin + 1) - top,
  };
}
