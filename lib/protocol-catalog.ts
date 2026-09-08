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

/**
 * `discipline` mapeia o protocolo para o valor de disciplina usado no PTS
 * (mesma lista de app/supervisao/planos/novo/disciplines.ts) — usado só para
 * pré-preencher a sugestão de meta ao "Montar PTS" a partir de uma avaliação
 * já aplicada; o supervisor pode trocar livremente no formulário.
 *
 * Instrumentos que já têm implementação própria NÃO entram nesta lista: ADL-2
 * e PROC (lib/fono-instruments/) e Socially Savvy (lib/socially-savvy/) têm
 * catálogo fixo, escala e cálculo próprios. O checklist genérico daqui só
 * aceita 0/1/2 (ASSESSMENT_SCORE_LABEL em lib/protocol-assessments.ts), então
 * cadastrá-los aqui abriria uma segunda porta com a escala errada, onde a
 * terapeuta preencheria uma avaliação que não conversa com a de verdade.
 * Nenhum protocolo havia sido cadastrado quando os três foram removidos.
 * `findProtocolCatalogEntry` devolve undefined para nomes fora da lista e
 * quem consome já cai no `?? protocol.name`, então uma linha antiga no banco
 * continuaria legível.
 */
export const PROTOCOL_CATALOG = [
  { name: "vbmapp", displayName: "VB-MAPP", area: "comportamental", discipline: "aba" },
  { name: "ablls_r", displayName: "ABLLS-R", area: "comportamental", discipline: "aba" },
  { name: "esdm", displayName: "Denver / ESDM", area: "comportamental", discipline: "denver_esdm" },
  { name: "afls", displayName: "AFLS", area: "funcional", discipline: "terapia_ocupacional" },
  { name: "abla_r", displayName: "ABLA-R", area: "comportamental", discipline: "aba" },
  { name: "ipo", displayName: "IPO", area: "cognitiva", discipline: "psicologia" },
  { name: "pep_r", displayName: "PEP-R", area: "cognitiva", discipline: "psicologia" },
  { name: "iar", displayName: "IAR", area: "cognitiva", discipline: "psicologia" },
  { name: "pcl", displayName: "PCL-R (Cognitivo-Linguístico)", area: "cognitiva", discipline: "psicologia" },
  { name: "tgmd2", displayName: "TGMD-2", area: "psicomotora", discipline: "fisioterapia" },
  { name: "avaliacao_neuromuscular", displayName: "Avaliação neuromuscular", area: "psicomotora", discipline: "fisioterapia" },
  { name: "abfw", displayName: "ABFW", area: "linguistica", discipline: "fonoaudiologia" },
  { name: "matriz_comunicacao", displayName: "Matriz de Comunicação", area: "linguistica", discipline: "fonoaudiologia" },
  { name: "copm", displayName: "COPM", area: "funcional", discipline: "terapia_ocupacional" },
  { name: "spm", displayName: "SPM / SPM-P", area: "funcional", discipline: "terapia_ocupacional" },
  { name: "escala_labirinto", displayName: "Escala Labirinto — Comportamento Alimentar", area: "nutricional", discipline: "outra" },
  { name: "demuca", displayName: "DEMUCA", area: "musical", discipline: "outra" },
  { name: "outro", displayName: "Outro protocolo", area: null, discipline: "outra" },
] as const;

export type ProtocolCatalogEntry = (typeof PROTOCOL_CATALOG)[number];

export const PROTOCOL_LABEL: Record<string, string> = Object.fromEntries(
  PROTOCOL_CATALOG.map((p) => [p.name, p.displayName]),
);

export function findProtocolCatalogEntry(name: string): ProtocolCatalogEntry | undefined {
  return PROTOCOL_CATALOG.find((p) => p.name === name);
}

export async function getEnabledProtocolsForClinic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  clinicId: string
): Promise<{ name: string; displayName: string; area: string | null; discipline: string }[]> {
  const { data: registeredProtocols } = await supabase
    .from("protocols")
    .select("name, display_name")
    .eq("clinic_id", clinicId);

  if (!registeredProtocols || registeredProtocols.length === 0) {
    return PROTOCOL_CATALOG.filter((p) => p.name !== "outro");
  }

  const registeredMap = new Map<string, { name: string; display_name?: string | null }>(
    registeredProtocols.map((r: { name: string; display_name?: string | null }) => [r.name, r])
  );

  const enabledFromCatalog = PROTOCOL_CATALOG.filter((p) => p.name !== "outro" && registeredMap.has(p.name)).map(
    (p) => {
      const reg = registeredMap.get(p.name);
      return {
        ...p,
        displayName: reg?.display_name || p.displayName,
      };
    }
  );

  const catalogNames = new Set<string>(PROTOCOL_CATALOG.map((p) => p.name));
  const customProtocols = registeredProtocols
    .filter((r: { name: string }) => r.name !== "outro" && !catalogNames.has(r.name))
    .map((r: { name: string; display_name?: string | null }) => ({
      name: r.name,
      displayName: r.display_name || r.name,
      area: null,
      discipline: "outra",
    }));

  return [...enabledFromCatalog, ...customProtocols];
}

