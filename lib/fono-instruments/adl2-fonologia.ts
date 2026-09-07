// "Observação da Aquisição Fonológica e do Vocabulário" do ADL-2 — anexo à
// escala principal (não é um teste fonoaudiológico por si só). As 40
// palavras-alvo e os fonemas cobrados em cada uma vêm do "Protocolo de
// Aplicação e Pontuação" oficial de Maria Lucia Menezes (booktoy.com.br/
// download/Protocolo%20ADL2_28x21_ALT4.pdf, seção "Observação da aquisição
// fonológica e do vocabulário"), reproduzidas também na planilha da clínica
// "ADL--2.xlsx" (aba "OBS AQUISIÇÃO FONOLÓGICA").
//
// 5 faixas etárias (3a a 5a 11m), pontuadas com um código por palavra:
// + emissão correta do fonema-alvo | - não emite o som-alvo |
// N nomeia a figura | R só repete corretamente a palavra e o som-alvo |
// NR não repete.
import type { FonologiaCode } from "./types";

export const FONOLOGIA_CODE_LABEL: Record<FonologiaCode, string> = {
  "+": "Emissão correta do fonema-alvo",
  "-": "Não emite o som-alvo",
  N: "Nomeia a figura",
  R: "Só repete corretamente a palavra e o som-alvo",
  NR: "Não repete",
};

export type FonologiaWord = {
  number: number;
  word: string;
  phonemes: string;
  bandKey: string;
};

export type FonologiaBand = { key: string; label: string; range: [number, number] };

export const FONOLOGIA_BANDS: FonologiaBand[] = [
  { key: "f1", label: "3 anos a 3 anos e 5 meses", range: [1, 19] },
  { key: "f2", label: "3 anos e 6 meses a 3 anos e 11 meses", range: [20, 24] },
  { key: "f3", label: "4 anos a 4 anos e 5 meses", range: [25, 28] },
  { key: "f4", label: "4 anos e 6 meses a 4 anos e 11 meses", range: [29, 32] },
  { key: "f5", label: "5 anos a 5 anos e 11 meses", range: [33, 40] },
];

function bandKeyFor(n: number): string {
  const band = FONOLOGIA_BANDS.find((b) => n >= b.range[0] && n <= b.range[1]);
  if (!band) throw new Error(`Palavra ${n} fora das faixas da Observação da Aquisição Fonológica`);
  return band.key;
}

const RAW_WORDS: [number, string, string][] = [
  [1, "bola", "/b/"],
  [2, "moto", "/m/; /t/"],
  [3, "cama", "/c/; /m/"],
  [4, "dedo", "/d/"],
  [5, "tênis", "/t/; /n/"],
  [6, "pato", "/p/; /t/"],
  [7, "pipa", "/p/"],
  [8, "nuvem", "/n/"],
  [9, "banana", "/n/"],
  [10, "gato", "/g/"],
  [11, "galinha", "/nh/"],
  [12, "água", "/gu/"],
  [13, "faca", "/f/"],
  [14, "café", "/f/"],
  [15, "vaca", "/v/"],
  [16, "avião", "/v/"],
  [17, "sapato", "/s/"],
  [18, "calça", "/s/"],
  [19, "mesa", "/z/"],
  [20, "chave", "/ch/"],
  [21, "peixe", "/ch/"],
  [22, "rato", "/rr/"],
  [23, "carro", "/rr/"],
  [24, "joaninha", "/j/"],
  [25, "lápis", "/l/"],
  [26, "bola", "/l/"],
  [27, "palhaço", "/lh/"],
  [28, "jacaré", "/r/"],
  [29, "garfo", "/rf/"],
  [30, "porco", "/rc/"],
  [31, "escova", "/sc/"],
  [32, "sorvete", "/rv/"],
  [33, "prato", "/pr/"],
  [34, "Brasil", "/br/"],
  [35, "cobra", "/br/"],
  [36, "dragão", "/dr/"],
  [37, "flor", "/fl/"],
  [38, "trem", "/tr/"],
  [39, "planta", "/pl/"],
  [40, "presente", "/pr/"],
];

export const FONOLOGIA_WORDS: FonologiaWord[] = RAW_WORDS.map(([number, word, phonemes]) => ({
  number,
  word,
  phonemes,
  bandKey: bandKeyFor(number),
}));
