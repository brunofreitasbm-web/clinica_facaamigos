// lib/draft-split.ts
//
// Divide na entrada um rascunho de "cadastro assistido por IA" que trouxe
// documentos de mais de uma criança (irmãos/gêmeos no mesmo contato).
// É o inverso de lib/draft-merge.ts: aquele junta conversas da MESMA criança,
// este separa crianças diferentes. Sem a divisão, o pipeline (paciente-lead,
// autorização, Agenda de 1ª Avaliação) trata o contato como um paciente só e
// as demais crianças somem da fila.
//
// Aqui só a parte pura (decide e monta); a gravação fica em lib/draft-split-db.ts.

import { areNamesMatching, normalizeName } from "./draft-merge.ts";

export type SiblingInput = {
  full_name: string;
  birth_date: string | null;
  cpf: string | null;
  cid: string | null;
  card_number: string | null;
  document_indexes: number[];
};

type Block = Record<string, unknown>;

export type SplitFile = { id: string; detectedType: string | null };

export type SiblingPlan = {
  sibling: SiblingInput;
  extracted: Block;
  /** Arquivos exclusivos desta criança: trocam de rascunho. */
  moveFileIds: string[];
  /** Arquivos comuns (RG do responsável, comprovante): ganham uma cópia no rascunho novo. */
  copyFileIds: string[];
};

const asBlock = (v: unknown): Block => (v && typeof v === "object" && !Array.isArray(v) ? (v as Block) : {});

/** Tipos de arquivo que pertencem à família, não a uma criança em particular. */
const SHARED_TYPES = new Set(["comprovante_residencia", "outro"]);

/**
 * Mesma criança? Exige o mesmo primeiro nome além do `areNamesMatching`, que é
 * frouxo de propósito para juntar variações ("Ana Silva Souza" ~ "Bia Silva Souza"
 * passaria) — aqui um falso positivo faria um irmão real deixar de ser criado.
 */
function isSameChild(a: string | null | undefined, b: string): boolean {
  if (!a || !areNamesMatching(a, b)) return false;
  return normalizeName(a).split(" ")[0] === normalizeName(b).split(" ")[0];
}

/**
 * Irmãos a criar, sem os que já existem. `knownNames` são os nomes de criança
 * dos rascunhos vivos do mesmo telefone (inclui o próprio): reprocessar a
 * extração não pode duplicar irmão já separado. Nome repetido dentro da própria
 * lista também é descartado.
 */
export function siblingsToCreate(extracted: unknown, knownNames: (string | null | undefined)[]): SiblingInput[] {
  const children = asBlock(extracted).additional_children;
  if (!Array.isArray(children)) return [];

  const seen = [...knownNames];
  const result: SiblingInput[] = [];
  for (const raw of children) {
    const child = asBlock(raw);
    const name = typeof child.full_name === "string" ? child.full_name.trim() : "";
    if (!name) continue;
    if (seen.some((known) => isSameChild(known, name))) continue;
    seen.push(name);
    result.push({
      full_name: name,
      birth_date: typeof child.birth_date === "string" ? child.birth_date : null,
      cpf: typeof child.cpf === "string" ? child.cpf : null,
      cid: typeof child.cid === "string" ? child.cid : null,
      card_number: typeof child.card_number === "string" ? child.card_number : null,
      document_indexes: Array.isArray(child.document_indexes)
        ? child.document_indexes.filter((n): n is number => typeof n === "number")
        : [],
    });
  }
  return result;
}

/**
 * Monta o rascunho de um irmão a partir do extraído do contato: herda responsável,
 * endereço e convênio (operadora), mas nunca CPF/carteirinha/CID/guia da outra
 * criança. A guia do contato é da criança principal, então não é copiada.
 */
export function buildSiblingExtraction(base: unknown, sibling: SiblingInput): Block {
  const ext = asBlock(base);
  const basePatient = asBlock(ext.patient);
  const baseInsurance = asBlock(ext.insurance);
  const mine = new Set(sibling.document_indexes);

  const documents = (Array.isArray(ext.documents) ? ext.documents : []).filter((d) => {
    const index = asBlock(d).index;
    return typeof index === "number" && mine.has(index);
  });

  return {
    patient: {
      full_name: sibling.full_name,
      birth_date: sibling.birth_date,
      cpf: sibling.cpf,
      sexo: null,
      naturalidade: null,
      cid: sibling.cid,
      complaint_hint: basePatient.complaint_hint ?? null,
    },
    guardian: ext.guardian ?? {},
    address: ext.address ?? {},
    insurance: { ...baseInsurance, card_number: sibling.card_number, card_valid_until: null },
    authorization: {},
    documents,
    additional_children: [],
    confidence: {},
    warnings: [
      `Cadastro separado automaticamente do contato de ${String(basePatient.full_name ?? "outra criança")}: confira nascimento, CPF e CID.`,
    ],
  };
}

/** Do extraído do contato, remove as crianças já separadas (a principal fica sem os irmãos). */
export function stripSiblings(extracted: unknown, splitCount: number): Block {
  const ext = asBlock(extracted);
  const warnings = Array.isArray(ext.warnings) ? ext.warnings : [];
  return {
    ...ext,
    additional_children: [],
    warnings: [
      ...warnings,
      `${splitCount} irmão(s) foram separados em cadastros próprios nesta fila.`,
    ],
  };
}

/**
 * Distribui os arquivos: os apontados em `document_indexes` do irmão vão para ele;
 * tipos de família (comprovante, outros) e os que não são de ninguém em especial
 * ficam com a principal e ganham cópia no irmão. `fileByIndex` é a ordem de envio
 * dos arquivos (mesma numeração que a IA recebeu).
 */
export function planSiblingFiles(
  sibling: SiblingInput,
  allSiblings: SiblingInput[],
  fileByIndex: SplitFile[],
): { moveFileIds: string[]; copyFileIds: string[] } {
  const mine = new Set(sibling.document_indexes);
  const others = new Set(allSiblings.filter((s) => s !== sibling).flatMap((s) => s.document_indexes));

  const moveFileIds: string[] = [];
  const copyFileIds: string[] = [];
  fileByIndex.forEach((file, index) => {
    if (mine.has(index) && !others.has(index)) moveFileIds.push(file.id);
    else if (!mine.has(index) && !others.has(index) && SHARED_TYPES.has(file.detectedType ?? "outro")) copyFileIds.push(file.id);
  });
  return { moveFileIds, copyFileIds };
}

export function planSiblings(extracted: unknown, siblings: SiblingInput[], fileByIndex: SplitFile[]): SiblingPlan[] {
  return siblings.map((sibling) => ({
    sibling,
    extracted: buildSiblingExtraction(extracted, sibling),
    ...planSiblingFiles(sibling, siblings, fileByIndex),
  }));
}
