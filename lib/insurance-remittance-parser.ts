// lib/insurance-remittance-parser.ts
// Reconhecimento das "notas" (demonstrativos de pagamento) que os planos de
// saúde mandam, para o painel de recebíveis da DRE (/gestor/financeiro/dre).
//
// Por que reconhecimento por COORDENADA e não por texto corrido: demonstrativo
// é tabela numérica de colunas fixas (apresentado / glosado / liberado). Lido
// como texto linearizado, os valores trocam de coluna e dinheiro errado entra
// direto na DRE. Aqui o PDF é lido item a item com posição (`extractTextItems`
// do unpdf, que já é dependência do projeto), as colunas saem das faixas de x
// do cabeçalho e cada valor é atribuído à coluna em que ele está de fato —
// mesmo critério de tabela do pdfplumber, mas dentro do processo Node, sem
// runtime externo.
//
// Mesmo padrão de "sem fallback fabricado" do resto do sistema: qualquer falha
// de leitura devolve `{ success: false, error }`, nunca um valor estimado.
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { extractTextItems } from "unpdf";

export const REMITTANCE_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const REMITTANCE_ACCEPTED_EXTENSIONS = [".pdf", ".csv", ".txt", ".xlsx", ".xlsm"] as const;

export type RemittanceLine = {
  guideNumber: string | null;
  patientName: string | null;
  procedureCode: string | null;
  sessions: number | null;
  grossAmount: number | null;
  glosaAmount: number | null;
  netAmount: number;
  serviceDate: string | null;
  /** true quando a linha veio do texto corrido (sem tabela): exige conferência. */
  lowConfidence: boolean;
  raw: string | null;
};

export type RemittanceParseResult = {
  sourceFile: string;
  detectedInsurer: string | null;
  competenceMonth: string | null;
  lines: RemittanceLine[];
  warnings: string[];
  totals: { gross: number; glosa: number; net: number };
};

export type RemittanceParseOutcome =
  | { success: true; result: RemittanceParseResult }
  | { success: false; error: string };

// ------------------------------------------------------------- normalização

const MONEY_RE = /(?<![\d,.])(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})(?!\d)/g;
const GUIA_RE = /\b(\d{6,20})\b/;
const DATE_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
const COMPETENCE_RE = /compet[eê]ncia\D{0,12}(\d{2})[/-](\d{4})/i;
const NAME_RE = /([A-ZÀ-Ü][A-Za-zÀ-Üà-ü]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ü][A-Za-zÀ-Üà-ü]+){1,5})/;
const SUMMARY_RE = /\b(totais|total|subtotal|sub total|soma|resumo|acumulado)\b/;

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Mn}/gu, "");
}

/** Texto sem acento, minúsculo e com espaço simples — a chave de comparação do cabeçalho. */
export function normalizeLabel(value: unknown): string {
  if (value === null || value === undefined) return "";
  return stripAccents(String(value)).toLowerCase().replace(/\s+/g, " ").trim();
}

/** "1.234,56" / "1234.56" / "R$ 89,90" → número. Devolve null quando não é valor. */
export function parseMoney(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  const negative = text.startsWith("-") || (text.startsWith("(") && text.endsWith(")"));
  const cleaned = text.replace(/[^\d,.-]/g, "").replace(/^-/, "");
  if (!cleaned || !/\d/.test(cleaned)) return null;
  // Formato brasileiro: ponto é milhar, vírgula é decimal.
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** dd/mm/aaaa → aaaa-mm-dd. */
export function parseBrDateToIso(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = DATE_RE.exec(raw);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Aceita a competência só no formato YYYY-MM — qualquer outra coisa vira null. */
export function normalizeCompetence(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(value.trim());
  return match ? `${match[1]}-${match[2]}` : null;
}

// --------------------------------------------------------- colunas conhecidas

type Field = "guide_number" | "patient_name" | "procedure_code" | "sessions" | "gross_amount" | "glosa_amount" | "net_amount" | "service_date";

// Ordem importa: "valor glosado" é testado antes do "valor" genérico.
const COLUMN_KEYWORDS: [Field, string[]][] = [
  ["glosa_amount", ["valor glosado", "vl glosado", "valor glosa", "vl glosa", "glosado", "glosa"]],
  ["net_amount", ["valor liberado", "valor pago", "vl pago", "valor a receber", "valor liquido", "liquido", "liberado", "pago"]],
  ["gross_amount", ["valor apresentado", "valor informado", "valor bruto", "vl apresentado", "apresentado", "informado", "valor cobrado", "valor"]],
  ["sessions", ["qtde", "quantidade", "sessoes", "qtd", "qt"]],
  ["guide_number", ["numero da guia", "n da guia", "no guia", "guia prestador", "guia"]],
  ["procedure_code", ["codigo do procedimento", "cod procedimento", "procedimento", "codigo tuss", "tuss", "codigo", "servico"]],
  ["patient_name", ["nome do beneficiario", "beneficiario", "paciente", "cliente", "nome"]],
  ["service_date", ["data do atendimento", "data atendimento", "data realizacao", "data"]],
];

/** Casa cada célula do cabeçalho com um campo conhecido; cada campo é usado uma vez só. */
export function mapHeaders(cells: string[]): Map<number, Field> {
  const mapping = new Map<number, Field>();
  const taken = new Set<Field>();
  cells.forEach((cell, index) => {
    const label = normalizeLabel(cell);
    if (!label) return;
    for (const [field, keywords] of COLUMN_KEYWORDS) {
      if (taken.has(field)) continue;
      if (keywords.some((keyword) => label.includes(keyword))) {
        mapping.set(index, field);
        taken.add(field);
        return;
      }
    }
  });
  return mapping;
}

/** Cabeçalho de verdade tem ao menos uma coluna de valor e uma de identificação. */
export function looksLikeHeader(cells: string[]): boolean {
  const fields = new Set(mapHeaders(cells).values());
  const hasMoney = fields.has("gross_amount") || fields.has("net_amount") || fields.has("glosa_amount");
  const hasKey = fields.has("guide_number") || fields.has("patient_name") || fields.has("procedure_code");
  return hasMoney && hasKey;
}

/** Linhas de fechamento repetem valores já contados linha a linha — nunca viram recebível. */
export function isSummaryRow(cells: string[]): boolean {
  return SUMMARY_RE.test(normalizeLabel(cells.join(" ")));
}

type RawRow = Partial<Record<Field, string | number | null>> & { raw?: string; lowConfidence?: boolean };

export function rowFromCells(cells: string[], mapping: Map<number, Field>): RawRow | null {
  if (isSummaryRow(cells)) return null;

  const row: RawRow = {};
  for (const [index, field] of mapping) {
    const text = (cells[index] ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (field === "gross_amount" || field === "net_amount" || field === "glosa_amount") {
      row[field] = parseMoney(text);
    } else if (field === "sessions") {
      const digits = text.replace(/\D/g, "");
      row[field] = digits ? Number(digits) : null;
    } else if (field === "service_date") {
      row[field] = parseBrDateToIso(text);
    } else {
      row[field] = text;
    }
  }

  const hasMoney = ["gross_amount", "net_amount", "glosa_amount"].some((f) => row[f as Field] !== undefined && row[f as Field] !== null);
  const hasKey = ["guide_number", "patient_name", "procedure_code"].some((f) => Boolean(row[f as Field]));
  if (!hasMoney || !hasKey) return null;

  row.raw = cells.filter((cell) => cell.trim()).join(" | ");
  return row;
}

/** Fallback para PDF sem cabeçalho reconhecido: uma linha com guia/nome + valor(es). */
export function rowFromFreeText(line: string): RawRow | null {
  if (isSummaryRow([line])) return null;
  const amounts = (line.match(MONEY_RE) ?? []).map(parseMoney).filter((value): value is number => value !== null);
  if (amounts.length === 0) return null;

  const withoutMoney = line.replace(MONEY_RE, " ");
  const guide = GUIA_RE.exec(withoutMoney)?.[1] ?? null;
  const name = NAME_RE.exec(withoutMoney)?.[1]?.trim() ?? null;
  if (!guide && !name) return null;

  // Sem cabeçalho não dá para saber qual coluna é qual: o último valor da linha
  // é, na esmagadora maioria dos demonstrativos, o valor liberado.
  return {
    guide_number: guide,
    patient_name: name,
    gross_amount: amounts.length > 1 ? amounts[0]! : null,
    net_amount: amounts[amounts.length - 1]!,
    service_date: parseBrDateToIso(line),
    raw: line.replace(/\s+/g, " ").trim(),
    lowConfidence: true,
  };
}

// ------------------------------------------------------------------- leitura

export type Cell = { text: string; x: number; right: number };

/**
 * Agrupa os itens de texto da página em linhas (por y) e, dentro de cada linha,
 * junta os itens colados num mesmo rótulo/valor (por distância em x).
 */
function buildRows(items: { str: string; x: number; y: number; width: number; fontSize: number }[]): Cell[][] {
  const relevant = items.filter((item) => item.str.trim().length > 0);
  if (relevant.length === 0) return [];

  const sorted = [...relevant].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: (typeof sorted)[] = [];
  let current: typeof sorted = [];
  let currentY: number | null = null;

  for (const item of sorted) {
    const tolerance = Math.max(2, item.fontSize * 0.5);
    if (currentY === null || Math.abs(item.y - currentY) <= tolerance) {
      current.push(item);
      currentY = currentY === null ? item.y : currentY;
    } else {
      rows.push(current);
      current = [item];
      currentY = item.y;
    }
  }
  if (current.length > 0) rows.push(current);

  return rows.map((rowItems) => {
    const ordered = [...rowItems].sort((a, b) => a.x - b.x);
    const cells: Cell[] = [];
    for (const item of ordered) {
      const previous = cells[cells.length - 1];
      const gap = previous ? item.x - previous.right : Number.POSITIVE_INFINITY;
      // Itens quase encostados são o mesmo rótulo ("Valor" + "Apresentado")
      // quebrado pelo gerador do PDF; a partir de ~1 caractere de espaço, é outra coluna.
      if (previous && gap < item.fontSize * 0.9) {
        previous.text = `${previous.text}${gap > item.fontSize * 0.2 ? " " : ""}${item.str}`;
        previous.right = item.x + item.width;
      } else {
        cells.push({ text: item.str, x: item.x, right: item.x + item.width });
      }
    }
    return cells;
  });
}

/** `x` é o centro estimado da coluna, derivado da posição do rótulo no cabeçalho. */
type HeaderColumn = { field: Field; x: number };

/**
 * Descobre as colunas do cabeçalho pela POSIÇÃO de cada palavra-chave.
 *
 * Não dá para confiar na quebra em células: o pdf.js entrega "Data Atendimento
 * Valor ApresentadoValor Glosado" como um item só quando os rótulos quase
 * encostam. Então cada palavra-chave é procurada dentro do texto do item e a
 * posição dela é estimada proporcionalmente à largura — em fonte uniforme, que
 * é o caso de um demonstrativo, isso cai em cima do x real da coluna.
 */
export function scanHeaderFields(cells: Cell[]): HeaderColumn[] {
  const consumed = cells.map(() => [] as [number, number][]);
  const found: HeaderColumn[] = [];

  for (const [field, keywords] of COLUMN_KEYWORDS) {
    let matched = false;
    for (const keyword of keywords) {
      for (const [cellIndex, cell] of cells.entries()) {
        const label = normalizeLabel(cell.text);
        for (let at = label.indexOf(keyword); at >= 0; at = label.indexOf(keyword, at + 1)) {
          const end = at + keyword.length;
          if (consumed[cellIndex]!.some(([from, to]) => at < to && end > from)) continue;
          consumed[cellIndex]!.push([at, end]);
          // Centro do rótulo, não a borda: coluna de dinheiro costuma vir
          // alinhada à direita, e aí o valor fica à direita do início do rótulo.
          const middle = at + keyword.length / 2;
          found.push({ field, x: cell.x + (middle / Math.max(1, label.length)) * (cell.right - cell.x) });
          matched = true;
          break;
        }
        if (matched) break;
      }
      if (matched) break;
    }
  }

  return found.sort((a, b) => a.x - b.x);
}

function hasTableShape(columns: HeaderColumn[]): boolean {
  const fields = new Set(columns.map((column) => column.field));
  const hasMoney = fields.has("gross_amount") || fields.has("net_amount") || fields.has("glosa_amount");
  const hasKey = fields.has("guide_number") || fields.has("patient_name") || fields.has("procedure_code");
  return hasMoney && hasKey;
}

/**
 * Cada coluna vale até o meio do caminho até a seguinte. É isso que põe o valor
 * na coluna certa mesmo com célula vazia no meio ou número alinhado à direita.
 */
export function assignToColumns(row: Cell[], columns: HeaderColumn[]): string[] {
  const texts = columns.map(() => "");
  for (const cell of row) {
    const center = (cell.x + cell.right) / 2;
    let best = 0;
    for (let index = 0; index < columns.length; index++) {
      const start = index === 0 ? Number.NEGATIVE_INFINITY : (columns[index - 1]!.x + columns[index]!.x) / 2;
      const end = index === columns.length - 1 ? Number.POSITIVE_INFINITY : (columns[index]!.x + columns[index + 1]!.x) / 2;
      if (center >= start && center < end) {
        best = index;
        break;
      }
    }
    texts[best] = texts[best] ? `${texts[best]} ${cell.text}` : cell.text;
  }
  return texts;
}

async function readPdf(bytes: Buffer): Promise<{ rows: RawRow[]; warnings: string[]; text: string }> {
  const { items } = await extractTextItems(new Uint8Array(bytes));
  const rows: RawRow[] = [];
  const warnings: string[] = [];
  const textParts: string[] = [];

  items.forEach((pageItems, pageIndex) => {
    const pageRows = buildRows(pageItems);
    textParts.push(pageRows.map((row) => row.map((cell) => cell.text).join(" ")).join("\n"));

    let columns: HeaderColumn[] | null = null;
    let mapping: Map<number, Field> | null = null;
    let tableRows = 0;

    for (const row of pageRows) {
      if (!columns) {
        const candidate = scanHeaderFields(row);
        if (hasTableShape(candidate)) {
          columns = candidate;
          mapping = new Map(candidate.map((column, index) => [index, column.field]));
        }
        continue;
      }
      const parsed = rowFromCells(assignToColumns(row, columns), mapping!);
      if (parsed) {
        rows.push(parsed);
        tableRows++;
      }
    }

    if (tableRows === 0) {
      let loose = 0;
      for (const row of pageRows) {
        const parsed = rowFromFreeText(row.map((cell) => cell.text).join(" "));
        if (parsed) {
          rows.push(parsed);
          loose++;
        }
      }
      if (loose > 0) {
        warnings.push(
          `Página ${pageIndex + 1}: nenhuma tabela reconhecida — ${loose} linha(s) lida(s) do texto corrido; confira os valores antes de consolidar.`,
        );
      }
    }
  });

  return { rows, warnings, text: textParts.join("\n") };
}

/** CSV com aspas e delimitador detectado (`;`, `,` ou tab). */
export function parseCsvRows(raw: string): string[][] {
  const sample = raw.slice(0, 4096);
  const counts: [string, number][] = [
    [";", (sample.match(/;/g) ?? []).length],
    [",", (sample.match(/,/g) ?? []).length],
    ["\t", (sample.match(/\t/g) ?? []).length],
  ];
  const delimiter = counts.sort((a, b) => b[1] - a[1])[0]![1] > 0 ? counts[0]![0] : ";";

  const rows: string[][] = [];
  let cells: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < raw.length; index++) {
    const char = raw[index]!;
    if (quoted) {
      if (char === '"') {
        if (raw[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      cells.push(value);
      value = "";
    } else if (char === "\n") {
      cells.push(value.replace(/\r$/, ""));
      rows.push(cells);
      cells = [];
      value = "";
    } else value += char;
  }
  if (value || cells.length > 0) {
    cells.push(value.replace(/\r$/, ""));
    rows.push(cells);
  }
  return rows;
}

function readTabular(rows: string[][], sheetLabel?: string): { rows: RawRow[]; warnings: string[] } {
  const parsed: RawRow[] = [];
  const warnings: string[] = [];
  let mapping: Map<number, Field> | null = null;

  for (const cells of rows) {
    if (!mapping) {
      if (looksLikeHeader(cells)) mapping = mapHeaders(cells);
      continue;
    }
    const row = rowFromCells(cells, mapping);
    if (row) parsed.push(row);
  }

  if (!mapping) {
    warnings.push(
      sheetLabel
        ? `Aba '${sheetLabel}': cabeçalho não reconhecido, nenhuma linha lida dela.`
        : "Nenhuma linha de cabeçalho reconhecida — confira se as colunas de guia/beneficiário e de valor estão nomeadas no arquivo.",
    );
  }
  return { rows: parsed, warnings };
}

// ------------------------------------------------------- xlsx (zip + xml)
// Leitor mínimo de .xlsx para as planilhas que alguns convênios mandam no
// lugar do PDF: um .xlsx é um zip deflate e o Node já traz `zlib`, então não
// entra dependência nova. Faz só o que o reconhecimento precisa — cada aba
// como matriz de strings; nada de fórmulas, formatação ou datas seriais.
type ZipEntry = { name: string; method: number; compressedSize: number; localHeaderOffset: number };

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Percorre o diretório central do zip e indexa as entradas por nome. */
function readZipEntries(buffer: Buffer): Map<string, ZipEntry> {
  // O EOCD fica no fim, depois de um comentário de até 64 KB.
  let eocd = -1;
  const lowest = Math.max(0, buffer.length - 66_000);
  for (let offset = buffer.length - 22; offset >= lowest; offset--) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("Arquivo .xlsx inválido: fim do zip não encontrado.");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);

  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    entries.set(name, { name, method, compressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntry(buffer: Buffer, entry: ZipEntry): string {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== LOCAL_SIGNATURE) throw new Error("Arquivo .xlsx inválido: entrada corrompida.");
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw.toString("utf8");
  if (entry.method === 8) return inflateRawSync(raw).toString("utf8");
  throw new Error(`Arquivo .xlsx com compressão não suportada (método ${entry.method}).`);
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return XML_ENTITIES[entity] ?? match;
  });
}

/** Concatena todos os <t> de um bloco — texto rico vem quebrado em vários. */
function textOf(xml: string): string {
  const parts = xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
  return parts.map((part) => decodeXml(part.replace(/<t[^>]*>/, "").replace(/<\/t>/, ""))).join("");
}

function parseSharedStrings(xml: string): string[] {
  const items = xml.match(/<si>[\s\S]*?<\/si>/g) ?? [];
  return items.map(textOf);
}

/** "BC12" → 54 (índice de coluna, base 0). */
function columnIndex(reference: string): number {
  const letters = /^([A-Z]+)/.exec(reference)?.[1];
  if (!letters) return 0;
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function parseSheet(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowXml of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const cells: string[] = [];
    for (const cellXml of rowXml.match(/<c[^>]*\/>|<c[^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const reference = /r="([A-Z]+\d+)"/.exec(cellXml)?.[1];
      const type = /t="([^"]+)"/.exec(cellXml)?.[1];
      let value = "";
      if (type === "inlineStr") {
        value = textOf(cellXml);
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1];
        if (raw !== undefined) {
          value = type === "s" ? (sharedStrings[Number(raw)] ?? "") : decodeXml(raw);
        }
      }
      const index = reference ? columnIndex(reference) : cells.length;
      while (cells.length < index) cells.push("");
      cells[index] = value;
    }
    rows.push(cells);
  }
  return rows;
}

export type XlsxSheet = { name: string; rows: string[][] };

/** Lê um .xlsx e devolve cada aba como matriz de strings, na ordem dos arquivos. */
export function readXlsxSheets(bytes: Buffer): XlsxSheet[] {
  const entries = readZipEntries(bytes);

  const sharedEntry = entries.get("xl/sharedStrings.xml");
  const sharedStrings = sharedEntry ? parseSharedStrings(readEntry(bytes, sharedEntry)) : [];

  const sheetNames = Array.from(entries.keys())
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));

  return sheetNames.map((name) => ({
    name: name.replace("xl/worksheets/", "").replace(".xml", ""),
    rows: parseSheet(readEntry(bytes, entries.get(name)!), sharedStrings),
  }));
}

// ------------------------------------------------------------------ detecção

const KNOWN_INSURERS = [
  "unimed", "bradesco saude", "amil", "sulamerica", "hapvida", "notredame",
  "porto seguro", "cassi", "geap", "postal saude", "petrobras", "camed",
  "ipsemg", "saude caixa", "capesesp", "life empresarial", "medsenior",
  "prevent senior", "omint", "care plus", "allianz", "assim saude",
];

function detectInsurer(text: string, fileName: string): string | null {
  const haystack = normalizeLabel(`${fileName} ${text.slice(0, 8000)}`);
  const found = KNOWN_INSURERS.find((name) => haystack.includes(name));
  return found ? found.replace(/\b\w/g, (letter) => letter.toUpperCase()) : null;
}

function detectCompetence(text: string, fileName: string, lines: RemittanceLine[]): string | null {
  const fromText = COMPETENCE_RE.exec(stripAccents(text));
  if (fromText) return `${fromText[2]}-${fromText[1]}`;

  const isoish = /(20\d{2})[-_.]?(0[1-9]|1[0-2])(?!\d)/.exec(fileName);
  if (isoish) return `${isoish[1]}-${isoish[2]}`;
  const brish = /(0[1-9]|1[0-2])[-_.](20\d{2})/.exec(fileName);
  if (brish) return `${brish[2]}-${brish[1]}`;

  const dates = lines.map((line) => line.serviceDate).filter((date): date is string => Boolean(date)).sort();
  return dates.length > 0 ? dates[Math.floor(dates.length / 2)]!.slice(0, 7) : null;
}

// ---------------------------------------------------------------------- api

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Normaliza cada linha crua: bruto e líquido se completam quando um dos dois falta. */
function toLines(rows: RawRow[]): RemittanceLine[] {
  const lines: RemittanceLine[] = [];
  for (const row of rows) {
    let gross = typeof row.gross_amount === "number" ? row.gross_amount : null;
    let net = typeof row.net_amount === "number" ? row.net_amount : null;
    const glosa = typeof row.glosa_amount === "number" ? row.glosa_amount : null;

    if (net === null && gross !== null) net = round2(gross - (glosa ?? 0));
    if (gross === null && net !== null) gross = round2(net + (glosa ?? 0));
    if (!net && !gross) continue;

    lines.push({
      guideNumber: typeof row.guide_number === "string" ? row.guide_number : null,
      patientName: typeof row.patient_name === "string" ? row.patient_name : null,
      procedureCode: typeof row.procedure_code === "string" ? row.procedure_code : null,
      sessions: typeof row.sessions === "number" ? row.sessions : null,
      grossAmount: gross,
      glosaAmount: glosa,
      netAmount: net ?? gross ?? 0,
      serviceDate: typeof row.service_date === "string" ? row.service_date : null,
      lowConfidence: row.lowConfidence === true,
      raw: row.raw ?? null,
    });
  }
  return lines;
}

/**
 * Lê a nota enviada e devolve as linhas de recebível. Nunca lança: erro de
 * leitura vira `{ success: false, error }` com a mensagem que o gestor vê.
 */
export async function parseRemittanceFile(
  file: { name: string; bytes: Buffer },
  options: { insurerName?: string | null; competenceMonth?: string | null } = {},
): Promise<RemittanceParseOutcome> {
  const extension = path.extname(file.name).toLowerCase();
  if (!REMITTANCE_ACCEPTED_EXTENSIONS.includes(extension as (typeof REMITTANCE_ACCEPTED_EXTENSIONS)[number])) {
    return { success: false, error: `Formato não suportado (${extension || "sem extensão"}). Envie PDF, CSV ou XLSX.` };
  }
  if (file.bytes.byteLength === 0) return { success: false, error: "O arquivo enviado está vazio." };
  if (file.bytes.byteLength > REMITTANCE_MAX_FILE_BYTES) {
    return { success: false, error: "Arquivo maior que 15 MB — envie o demonstrativo separado por competência." };
  }

  let rawRows: RawRow[] = [];
  const warnings: string[] = [];
  let text = "";

  try {
    if (extension === ".pdf") {
      const result = await readPdf(file.bytes);
      rawRows = result.rows;
      warnings.push(...result.warnings);
      text = result.text;
    } else if (extension === ".csv" || extension === ".txt") {
      const raw = file.bytes.toString("utf8").replace(/^﻿/, "");
      const result = readTabular(parseCsvRows(raw));
      rawRows = result.rows;
      warnings.push(...result.warnings);
      text = raw.slice(0, 20_000);
    } else {
      const sheets = readXlsxSheets(file.bytes);
      const textParts: string[] = [];
      for (const sheet of sheets) {
        const result = readTabular(sheet.rows, sheet.name);
        rawRows.push(...result.rows);
        warnings.push(...result.warnings);
        textParts.push(sheet.rows.map((row) => row.join(" ")).join("\n"));
      }
      text = textParts.join("\n").slice(0, 20_000);
    }
  } catch (error) {
    console.error("[remittance] falha ao ler a nota", error);
    return { success: false, error: "Não foi possível ler o arquivo — ele pode estar corrompido, protegido por senha ou ser um PDF digitalizado (imagem)." };
  }

  const lines = toLines(rawRows);
  if (lines.length === 0) warnings.push("Nenhuma linha de recebível reconhecida neste arquivo.");

  return {
    success: true,
    result: {
      sourceFile: file.name,
      detectedInsurer: options.insurerName ?? detectInsurer(text, file.name),
      competenceMonth: normalizeCompetence(options.competenceMonth) ?? detectCompetence(text, file.name, lines),
      lines,
      warnings,
      totals: {
        gross: round2(lines.reduce((sum, line) => sum + (line.grossAmount ?? 0), 0)),
        glosa: round2(lines.reduce((sum, line) => sum + (line.glosaAmount ?? 0), 0)),
        net: round2(lines.reduce((sum, line) => sum + line.netAmount, 0)),
      },
    },
  };
}
