/**
 * Catálogo de referência de protocolos de avaliação (Módulo 3 MAAIS, slides
 * 24-25) — substitui o antigo CHECK (name in ('vbmapp','ablls_r','esdm')) de
 * `protocols.name`, removido em
 * supabase/migrations/20260906000005_protocol_catalog_expand.sql. A validação
 * de nome passa a acontecer aqui, na Server Action de criação, não mais no
 * banco — mais fácil de estender sem migration a cada protocolo novo.
 */
export const PROTOCOL_AREAS = [
  { value: "cognitiva", label: "Cognitiva" },
  { value: "psicomotora", label: "Psicomotora" },
  { value: "comportamental", label: "Comportamental" },
  { value: "linguistica", label: "Linguística" },
  { value: "funcional", label: "Funcional (AVDs)" },
  { value: "nutricional", label: "Nutricional" },
  { value: "musical", label: "Musical" },
] as const;

export type ProtocolArea = (typeof PROTOCOL_AREAS)[number]["value"];

export const AREA_LABEL: Record<string, string> = Object.fromEntries(
  PROTOCOL_AREAS.map((a) => [a.value, a.label]),
);

export const PROTOCOL_CATALOG = [
  { name: "vbmapp", displayName: "VB-MAPP", area: "comportamental" },
  { name: "ablls_r", displayName: "ABLLS-R", area: "comportamental" },
  { name: "esdm", displayName: "Denver / ESDM", area: "comportamental" },
  { name: "afls", displayName: "AFLS", area: "funcional" },
  { name: "abla_r", displayName: "ABLA-R", area: "comportamental" },
  { name: "socially_savvy", displayName: "Socially Savvy", area: "comportamental" },
  { name: "ipo", displayName: "IPO", area: "cognitiva" },
  { name: "pep_r", displayName: "PEP-R", area: "cognitiva" },
  { name: "iar", displayName: "IAR", area: "cognitiva" },
  { name: "pcl", displayName: "PCL", area: "cognitiva" },
  { name: "tgmd2", displayName: "TGMD-2", area: "psicomotora" },
  { name: "avaliacao_neuromuscular", displayName: "Avaliação neuromuscular", area: "psicomotora" },
  { name: "adl2", displayName: "ADL2", area: "linguistica" },
  { name: "abfw", displayName: "ABFW", area: "linguistica" },
  { name: "matriz_comunicacao", displayName: "Matriz de Comunicação", area: "linguistica" },
  { name: "proc", displayName: "PROC", area: "linguistica" },
  { name: "copm", displayName: "COPM", area: "funcional" },
  { name: "spm", displayName: "SPM / SPM-P", area: "funcional" },
  { name: "escala_labirinto", displayName: "Escala Labirinto", area: "nutricional" },
  { name: "demuca", displayName: "DEMUCA", area: "musical" },
  { name: "outro", displayName: "Outro protocolo", area: null },
] as const;

export type ProtocolCatalogEntry = (typeof PROTOCOL_CATALOG)[number];

export const PROTOCOL_LABEL: Record<string, string> = Object.fromEntries(
  PROTOCOL_CATALOG.map((p) => [p.name, p.displayName]),
);

export function findProtocolCatalogEntry(name: string): ProtocolCatalogEntry | undefined {
  return PROTOCOL_CATALOG.find((p) => p.name === name);
}
