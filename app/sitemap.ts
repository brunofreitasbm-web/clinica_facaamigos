import type { MetadataRoute } from "next";

/**
 * Vazio de propósito: desde 30/09/2026 nenhuma página deste domínio é indexável
 * (ver app/robots.ts). Se a landing /site voltar a ser pública nos buscadores,
 * liste-a aqui de novo (`${CLINIC_WEBSITE}/site`) e reverta robots.ts/next.config.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
