/**
 * Tipos dos templates de protocolo genérico (estrutura configurável sem
 * licença). Ver docs/protocolos-genericos-fontes.md para o levantamento
 * jurídico por instrumento.
 *
 * Regra de autoria: domínios, níveis e escala reproduzem a ESTRUTURA
 * publicada do instrumento (fato, não protegido). O texto dos itens é
 * original (`contentLicense: "original"`) ou reproduzido de fonte CC-BY com
 * atribuição obrigatória (`contentLicense: "cc-by"`). Nunca copiar itens de
 * manual licenciado ou de tradução não autorizada.
 */

export type ProtocolTemplateItem = {
  /** Código curto e único dentro do template (ex.: "M1-01"). */
  code: string;
  /** Descrição observável do marco/habilidade/comportamento, em pt-BR. */
  description: string;
  /** Peso opcional (ex.: DEMUCA usa ×2 em 5 itens). Default 1. */
  weight?: number;
  /** Escala invertida: pontuação alta = pior (ex.: comportamentos restritivos). */
  inverted?: boolean;
};

export type ProtocolTemplateDomain = {
  /** Nome do domínio/área/categoria exibido como seção. */
  domain: string;
  /** Nível/faixa etária/protocolo (ex.: "Nível 1 (0-18 m)"). Opcional. */
  level?: string;
  items: ProtocolTemplateItem[];
};

export type ProtocolScale = {
  /** Maior valor da escala. */
  max: number;
  /** Menor valor da escala. Default 0 (a maioria dos instrumentos usa 0). COPM (1-10) e SPM (1-4) usam 1. */
  min?: number;
  /** Rótulo de cada valor inteiro de min..max que aparece como opção. Valores ausentes não são exibidos. */
  labels: Record<number, string>;
};

export type ProtocolTemplate = {
  /** Slug do PROTOCOL_CATALOG (lib/protocol-catalog.ts). */
  name: string;
  /** Nome de exibição do protocolo genérico — não usar a marca como nome do produto. */
  displayName: string;
  /** Versão do template (gravada em protocols.template_version). */
  version: string;
  scale: ProtocolScale;
  contentLicense: "original" | "cc-by";
  /** Obrigatório quando contentLicense = "cc-by". */
  attribution?: string;
  /** URLs das fontes usadas para a estrutura (artigos, manuais abertos). */
  sources: string[];
  /** Observações para o gestor (ex.: subconjunto representativo, completar via importador). */
  notes?: string;
  domains: ProtocolTemplateDomain[];
};

export function countTemplateItems(template: ProtocolTemplate): number {
  return template.domains.reduce((sum, d) => sum + d.items.length, 0);
}
