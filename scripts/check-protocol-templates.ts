/**
 * Verificação estática dos templates de protocolo genérico. Roda com:
 *   node --experimental-strip-types scripts/check-protocol-templates.ts
 *
 * Confere: slug presente no PROTOCOL_CATALOG, códigos únicos por template,
 * nenhuma descrição vazia/curta demais, atribuição obrigatória quando
 * contentLicense = "cc-by", e escala coerente (max > 0, todo valor 0..max
 * usado por algum item cabe num rótulo — não é obrigatório ter rótulo pra
 * todo inteiro, mas 0 e max precisam ter rótulo).
 */
// Importa cada template direto (extensão .ts explícita — obrigatória para
// `node --experimental-strip-types`, que não faz resolução "bundler" como o
// tsconfig do projeto) em vez de passar por lib/protocol-templates/index.ts,
// cujos imports internos sem extensão só resolvem sob bundler (Next.js/tsc).
import { PROTOCOL_CATALOG } from "../lib/protocol-catalog.ts";
import { countTemplateItems, type ProtocolTemplate } from "../lib/protocol-templates/types.ts";
import { vbmappTemplate } from "../lib/protocol-templates/vbmapp.ts";
import { abllsRTemplate } from "../lib/protocol-templates/ablls_r.ts";
import { esdmTemplate } from "../lib/protocol-templates/esdm.ts";
import { aflsTemplate } from "../lib/protocol-templates/afls.ts";
import { ablaRTemplate } from "../lib/protocol-templates/abla_r.ts";
import { ipoTemplate } from "../lib/protocol-templates/ipo.ts";
import { pepRTemplate } from "../lib/protocol-templates/pep_r.ts";
import { iarTemplate } from "../lib/protocol-templates/iar.ts";
import { pclTemplate } from "../lib/protocol-templates/pcl.ts";
import { tgmd2Template } from "../lib/protocol-templates/tgmd2.ts";
import { abfwTemplate } from "../lib/protocol-templates/abfw.ts";
import { matrizComunicacaoTemplate } from "../lib/protocol-templates/matriz_comunicacao.ts";
import { copmTemplate } from "../lib/protocol-templates/copm.ts";
import { spmTemplate } from "../lib/protocol-templates/spm.ts";
import { escalaLabirintoTemplate } from "../lib/protocol-templates/escala_labirinto.ts";
import { demucaTemplate } from "../lib/protocol-templates/demuca.ts";

const PROTOCOL_TEMPLATES: Record<string, ProtocolTemplate> = {
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

let errors = 0;
let totalItems = 0;

function fail(msg: string) {
  console.error(`✗ ${msg}`);
  errors++;
}

for (const [slug, template] of Object.entries(PROTOCOL_TEMPLATES)) {
  if (slug !== template.name) fail(`${slug}: chave do index (${slug}) difere de template.name (${template.name})`);

  if (!PROTOCOL_CATALOG.some((p) => p.name === template.name)) {
    fail(`${template.name}: não está em PROTOCOL_CATALOG (lib/protocol-catalog.ts)`);
  }

  if (template.contentLicense === "cc-by" && !template.attribution) {
    fail(`${template.name}: contentLicense "cc-by" sem attribution`);
  }

  const min = template.scale.min ?? 0;
  if (template.scale.max <= min) fail(`${template.name}: scale.max deve ser > scale.min`);
  if (!(min in template.scale.labels)) fail(`${template.name}: scale.labels sem rótulo para min (${min})`);
  if (!(template.scale.max in template.scale.labels)) fail(`${template.name}: scale.labels sem rótulo para max (${template.scale.max})`);

  const codes = new Set<string>();
  let itemCount = 0;
  for (const domain of template.domains) {
    if (!domain.domain.trim()) fail(`${template.name}: domínio com nome vazio`);
    for (const item of domain.items) {
      itemCount++;
      if (codes.has(item.code)) fail(`${template.name}: código duplicado "${item.code}"`);
      codes.add(item.code);
      if (!item.description || item.description.trim().length < 5) {
        fail(`${template.name}/${item.code}: descrição vazia ou curta demais`);
      }
      if (item.weight !== undefined && item.weight <= 0) fail(`${template.name}/${item.code}: weight deve ser > 0`);
    }
  }

  if (itemCount !== countTemplateItems(template)) {
    fail(`${template.name}: countTemplateItems (${countTemplateItems(template)}) diverge da contagem manual (${itemCount})`);
  }
  totalItems += itemCount;

  console.log(`${template.name.padEnd(22)} domínios=${template.domains.length.toString().padStart(3)} itens=${itemCount.toString().padStart(4)} escala=0-${template.scale.max} licença=${template.contentLicense}`);
}

console.log(`\nTotal: ${Object.keys(PROTOCOL_TEMPLATES).length} templates, ${totalItems} itens.`);

if (errors > 0) {
  console.error(`\n${errors} erro(s) encontrado(s).`);
  process.exit(1);
}
console.log("\nOK — todos os templates passaram na verificação.");
