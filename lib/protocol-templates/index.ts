/**
 * Índice dos templates de protocolo genérico configurável (estrutura sem
 * licença). Ver docs/protocolos-genericos-fontes.md para o levantamento
 * jurídico completo por instrumento.
 */
import { vbmappTemplate } from "./vbmapp";
import { abllsRTemplate } from "./ablls_r";
import { esdmTemplate } from "./esdm";
import { aflsTemplate } from "./afls";
import { ablaRTemplate } from "./abla_r";
import { ipoTemplate } from "./ipo";
import { pepRTemplate } from "./pep_r";
import { iarTemplate } from "./iar";
import { pclTemplate } from "./pcl";
import { tgmd2Template } from "./tgmd2";
import { abfwTemplate } from "./abfw";
import { matrizComunicacaoTemplate } from "./matriz_comunicacao";
import { copmTemplate } from "./copm";
import { spmTemplate } from "./spm";
import { escalaLabirintoTemplate } from "./escala_labirinto";
import { demucaTemplate } from "./demuca";
import type { ProtocolTemplate } from "./types";

export type { ProtocolTemplate, ProtocolTemplateDomain, ProtocolTemplateItem, ProtocolScale } from "./types";
export { countTemplateItems } from "./types";

/** Um template por slug do PROTOCOL_CATALOG (lib/protocol-catalog.ts). */
export const PROTOCOL_TEMPLATES: Record<string, ProtocolTemplate> = {
  vbmapp: vbmappTemplate,
  ablls_r: abllsRTemplate,
  esdm: esdmTemplate,
  afls: aflsTemplate,
  abla_r: ablaRTemplate,
  ipo: ipoTemplate,
  pep_r: pepRTemplate,
  iar: iarTemplate,
  pcl: pclTemplate,
  tgmd2: tgmd2Template,
  abfw: abfwTemplate,
  matriz_comunicacao: matrizComunicacaoTemplate,
  copm: copmTemplate,
  spm: spmTemplate,
  escala_labirinto: escalaLabirintoTemplate,
  demuca: demucaTemplate,
};

export function getProtocolTemplate(name: string): ProtocolTemplate | undefined {
  return PROTOCOL_TEMPLATES[name];
}

export function hasProtocolTemplate(name: string): boolean {
  return name in PROTOCOL_TEMPLATES;
}
