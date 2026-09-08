/**
 * Instrumentos de avaliação com implementação própria no sistema — catálogo
 * fixo em código, porque cada um tem escala, itens e cálculo próprios
 * (lib/fono-instruments/, lib/socially-savvy/). Diferente de
 * lib/protocol-catalog.ts, que é a lista de protocolos que o gestor cadastra
 * e digita à mão no checklist genérico 0/1/2.
 *
 * O que o banco guarda é só o liga/desliga por clínica
 * (`clinic_instruments`, 20260908020000_clinic_instruments.sql) mais os dados
 * de licença; o catálogo em si nunca vem do banco. Para adicionar um
 * instrumento novo: implemente-o e acrescente uma entrada aqui — a tela do
 * gestor, o bloqueio de acesso e os atalhos do prontuário saem de graça.
 */
export type NativeInstrumentKey = "socially_savvy" | "adl" | "adl2" | "proc";

export type NativeInstrument = {
  key: NativeInstrumentKey;
  /** Nome curto, para listas e botões. */
  shortLabel: string;
  /** Nome completo, para cabeçalhos de tela. */
  label: string;
  discipline: string;
  description: string;
  /** Hub do instrumento no prontuário do paciente. */
  patientHref: (patientId: string) => string;
};

export const NATIVE_INSTRUMENTS: NativeInstrument[] = [
  {
    key: "socially_savvy",
    shortLabel: "Socially Savvy",
    label: "Socially Savvy — Avaliação de Habilidades Sociais",
    discipline: "aba",
    description:
      "110 habilidades em 7 áreas do desenvolvimento social, pontuadas de 0 a 3 em até quatro aplicações, com PEI calculado automaticamente.",
    patientHref: (patientId) => `/terapeuta/paciente/${patientId}/socially-savvy`,
  },
  {
    key: "adl",
    shortLabel: "ADL",
    label: "ADL — Avaliação do Desenvolvimento da Linguagem",
    discipline: "fonoaudiologia",
    description: "Linguagem receptiva e expressiva por faixa etária, com escore bruto e classificação.",
    patientHref: (patientId) => `/terapeuta/paciente/${patientId}/fono`,
  },
  {
    key: "adl2",
    shortLabel: "ADL-2",
    label: "ADL-2 — Avaliação do Desenvolvimento da Linguagem 2",
    discipline: "fonoaudiologia",
    description: "Versão 2 do ADL, com o anexo de observação da aquisição fonológica e do vocabulário.",
    patientHref: (patientId) => `/terapeuta/paciente/${patientId}/fono`,
  },
  {
    key: "proc",
    shortLabel: "PROC",
    label: "PROC — Protocolo de Observação Comportamental",
    discipline: "fonoaudiologia",
    description: "Observação comportamental por seções, com pontuação por subseção e total.",
    patientHref: (patientId) => `/terapeuta/paciente/${patientId}/fono`,
  },
];

export const NATIVE_INSTRUMENT_KEYS = NATIVE_INSTRUMENTS.map((i) => i.key);

export function isNativeInstrumentKey(value: string): value is NativeInstrumentKey {
  return (NATIVE_INSTRUMENT_KEYS as string[]).includes(value);
}

export function findNativeInstrument(key: string): NativeInstrument | undefined {
  return NATIVE_INSTRUMENTS.find((i) => i.key === key);
}
