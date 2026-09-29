// lib/insurance-intake-nau-parser.ts
// Parser DETERMINÍSTICO (sem IA) da planilha "CONTROLE DE AGENDAMENTOS — NAU
// Unimed / PORTO TERAPIAS", o PDF digital que o convênio manda com dezenas de
// pacientes. Trabalha sobre o texto já extraído do PDF (unpdf) e devolve as
// linhas da tabela com guia, senha e cartão nas colunas certas — o regex
// genérico que existia antes em lib/insurance-intake-extraction.ts nunca
// preenchia a senha e pegava pedaços dela como "telefone".
//
// Limite conhecido (mesmo do texto linearizado do unpdf): quando a célula de
// TERAPIAS quebra em várias linhas, o texto dessas terapias cai no fim da
// página, longe do paciente, e não dá para associar com segurança. Nesses
// casos `therapies` vem vazio e a linha ganha um aviso — nunca um palpite. O
// parser em tabela (scripts/extract_convenio_patients.py) resolve esse caso.
//
// Arquivo PURO (sem imports com alias `@/`) para rodar em tests/*.test.ts.

export type NauRow = {
  seq: string;
  therapies: string[];
  name: string;
  birthDate: string; // dd/mm/yyyy, como no PDF
  age: string | null;
  phone: string | null;
  guide: string;
  password: string;
  card: string;
};

export type NauParseResult = {
  rows: NauRow[];
  /** Números de SEQ. que não aparecem entre as linhas lidas (linha perdida/quebrada). */
  missingSeqs: number[];
};

const THERAPY_WORDS = new Set([
  "FONOAUDIOLOGIA",
  "FONO",
  "TERAPIA",
  "OCUPACIONAL",
  "PSICOMOTRICIDADE",
  "PSICOPEDAGOGIA",
  "PSICOLOGIA",
  "MUSICOTERAPIA",
  "FISIOTERAPIA",
  "NUTRIÇÃO",
  "NUTRICAO",
  "ABA",
]);
const CONNECTORS = new Set(["E", "–", "—", "-", ","]);

// SEQ  [terapias + nome]  dd/mm/aaaa – N anos  [telefone]  GUIA SENHA CARTÃO
const ROW_RE =
  /^(\d{1,3})\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s*[–—-]\s*(\d{1,3})\s*(?:anos?|meses|m)?\s*(\(\d{2}\)\s*9?\d{4}-?\d{4})?\s+(\d{8,10})\s+(\d{8,10})\s+(\d{13,17})\b/i;

/** Separa o prefixo "TERAPIAS NOME" em terapias (vocabulário fechado) e nome. */
function splitTherapiesAndName(prefix: string): { therapies: string[]; name: string } {
  const tokens = prefix.split(/\s+/).filter(Boolean);
  let i = 0;
  const consumed: string[] = [];
  while (i < tokens.length) {
    const norm = tokens[i].replace(/[,.]$/, "").toUpperCase();
    if (THERAPY_WORDS.has(norm)) {
      consumed.push(norm);
      i++;
    } else if (consumed.length > 0 && CONNECTORS.has(norm)) {
      consumed.push(norm);
      i++;
    } else {
      break;
    }
  }
  // Conector que sobrou no fim do trecho de terapias não faz parte dele: devolve o token ao nome.
  while (consumed.length > 0 && CONNECTORS.has(consumed[consumed.length - 1])) {
    consumed.pop();
    i--;
  }

  // "E" e "," separam terapias; travessão liga ("FONOAUDIOLOGIA – ABA" é UMA terapia, como no script Python).
  const therapies: string[] = [];
  let current = "";
  for (const word of consumed) {
    if (word === "E" || word === ",") {
      if (current) therapies.push(current);
      current = "";
    } else if (word === "–" || word === "—" || word === "-") {
      current += " –";
    } else {
      current += current ? ` ${word}` : word;
    }
  }
  if (current) therapies.push(current);

  return { therapies, name: tokens.slice(i).join(" ") };
}

export function parseNauRows(text: string): NauParseResult {
  const rows: NauRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const m = ROW_RE.exec(rawLine.trim());
    if (!m) continue;
    const { therapies, name } = splitTherapiesAndName(m[2]);
    if (name.length < 3) continue;
    rows.push({
      seq: m[1],
      therapies,
      name,
      birthDate: m[3],
      age: m[4] ? `${m[4]} anos` : null,
      phone: m[5] ?? null,
      guide: m[6],
      password: m[7],
      card: m[8],
    });
  }

  const seqs = rows.map((r) => Number(r.seq));
  const missingSeqs: number[] = [];
  if (seqs.length > 0) {
    const seen = new Set(seqs);
    for (let n = Math.min(...seqs); n <= Math.max(...seqs); n++) if (!seen.has(n)) missingSeqs.push(n);
  }
  return { rows, missingSeqs };
}
