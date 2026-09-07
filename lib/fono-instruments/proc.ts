// PROC — Protocolo de Observação Comportamental (Zorzi & Hage), transcrito
// da planilha da clínica "PROC.xlsx" (aba PROC, B23:G83). A estrutura de
// subseções e as opções de pontuação seguem exatamente a planilha,
// incluindo as duas particularidades decididas com o usuário:
//  - 1a e 1b usam escala 0/1/2 por item (a planilha deixava a pontuação
//    livre nessas duas subseções).
//  - "Total 1c-1" soma vocalizações+gestos e "Total 1c-2" soma gestos+
//    verbais — os gestos entram duas vezes no Total Geral (PROC!C69), tal
//    como na planilha (decisão do usuário: reproduzir fielmente).
import type { ProcSection } from "./types";

// Escala 0 (ausente) / 1 (presente raramente) / 2 (presente frequentemente),
// usada em 1a e 1b (decisão do usuário — a planilha original não define
// escala para essas duas subseções).
const SCALE_012 = [
  { key: "0", label: "Ausente", value: 0 },
  { key: "1", label: "Presente raramente", value: 1 },
  { key: "2", label: "Presente frequentemente", value: 2 },
];

export const PROC_CATALOG: ProcSection[] = [
  {
    key: "1",
    label: "1. Habilidades comunicativas (expressivas)",
    max: 70, // PROC!C24 — constante da planilha, não recalculada a partir dos itens.
    subsections: [
      {
        key: "1a",
        label: "1a. Habilidades dialógicas ou conversacionais",
        mode: "scale012",
        max: 10, // 5 itens x 2 pontos
        items: [
          { key: "intencao_comunicativa", label: "Intenção comunicativa" },
          { key: "inicia_conversacao", label: "Inicia a conversação/interação" },
          { key: "responde_interlocutor", label: "Responde ao interlocutor" },
          { key: "aguarda_turno", label: "Aguarda seu turno (não se precipita, interrompendo o interlocutor)" },
          { key: "participa_dialogica", label: "Participa ativamente da atividade dialógica (alternância de turnos na interação)" },
        ],
      },
      {
        key: "1b",
        label: "1b. Funções comunicativas",
        mode: "scale012",
        max: 14, // 7 itens x 2 pontos
        items: [
          { key: "instrumental", label: 'Instrumental — solicitação de objetos, ações ("dar um brinquedo; abrir uma porta")' },
          { key: "protesto", label: 'Protesto — interrupção com fala ou ação de uma ação indesejada ("pára")' },
          { key: "interativa", label: 'Interativa — uso de expressões sociais para iniciar ou encerrar a interação ("oi, tchau")' },
          { key: "nomeacao", label: 'Nomeação — nomeação espontânea de objetos, pessoas, ações ("ó cachorro")' },
          { key: "informativa", label: 'Informativa — comentários, informações espontâneas na interação ("ó meu sapato")' },
          { key: "heuristica", label: 'Heurística — solicitação de informação ou permissão ("pode pegar? / Cadê a bola?")' },
          { key: "narrativa", label: 'Narrativa — presença de turnos narrativos ("o príncipe beijou a princesa e casou")' },
        ],
      },
      {
        key: "1c",
        label: "1c. Meios de comunicação",
        mode: "single",
        max: 22, // vocalizações(2) + gestos(5) + verbais(15) — informativo; ver Total 1c-1/1c-2 em scoring.ts
        items: [
          {
            key: "vocalizacoes",
            label: "Meios não verbais (vocalizações)",
            options: [
              { key: "ausencia", label: "Ausência de vocalizações", value: 0 },
              { key: "nao_articuladas", label: "Somente vocalizações não articuladas", value: 1 },
              { key: "articuladas_jargao", label: "Vocalizações não articuladas e articuladas com entonação da língua (jargão)", value: 2 },
            ],
          },
          {
            key: "gestos",
            label: "Meios não verbais (gestos)",
            options: [
              { key: "elementares", label: "Gestos não simbólicos elementares (pegar na mão e levar, puxar, cutucar)", value: 1 },
              { key: "convencionais", label: 'Gestos não simbólicos convencionais (apontar, negar com a cabeça, gesto de "vem cá")', value: 2 },
              { key: "simbolicos", label: "Gestos simbólicos (gestos que representam ações, objetos, idade)", value: 5 },
            ],
          },
          {
            key: "verbais",
            label: "Meios verbais (palavras, frases, discurso)",
            options: [
              { key: "palavras_isoladas", label: "Palavras isoladas", value: 7 },
              { key: "enunciados_2", label: "Enunciados de 2 palavras", value: 9 },
              { key: "frases_3", label: "Frases com 3 ou mais palavras, telegráficas ou não", value: 11 },
              { key: "relato_imediato", label: 'Relato de experiências imediatas, com frases de 5/6 palavras ("o que você está fazendo? Eu estou...")', value: 13 },
              { key: "relato_nao_imediato", label: 'Relato de experiências não imediatas ("o que aconteceu na escola? Teve um dia...")', value: 15 },
            ],
          },
        ],
      },
      {
        key: "1d",
        label: "1d. Níveis de contextualização da linguagem",
        mode: "single",
        max: 15,
        items: [
          {
            key: "nivel",
            label: "Nível de contextualização",
            options: [
              { key: "imediata", label: "Linguagem refere-se somente à situação imediata e concreta", value: 5 },
              { key: "descreve_acao", label: "Linguagem descreve a ação que está sendo realizada e faz referências ao passado e/ou futuro imediato, sem ultrapassar o contexto imediato", value: 10 },
              { key: "distante", label: "Linguagem vai além da situação imediata, referindo-se a eventos mais distantes no tempo", value: 15 },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "2",
    label: "2. Compreensão da linguagem verbal",
    max: 60, // PROC!C25
    subsections: [
      {
        key: "2a",
        label: "Compreensão verbal",
        mode: "single",
        max: 60,
        items: [
          {
            key: "nivel",
            label: "Nível de compreensão",
            options: [
              { key: "nao_responde", label: "Não apresenta respostas à linguagem", value: 0 },
              { key: "assistematico", label: "Responde não sistematicamente a uma solicitação, comentário ou quando chamado", value: 10 },
              { key: "atende_chamada", label: "Atende quando é chamada", value: 20 },
              { key: "ordem_1_gesto", label: 'Compreende ordens situacionais com uma ação, acompanhadas de gestos ("mande um beijo")', value: 30 },
              { key: "ordem_1_sem_gesto", label: "Compreende ordens situacionais com uma ação, não acompanhadas de gestos", value: 40 },
              { key: "duas_ordens", label: "Compreende duas ordens não relacionadas", value: 50 },
              { key: "tres_ordens", label: "Compreende ordens com 3 ou mais ações, solicitações ou comentários", value: 60 },
            ],
          },
        ],
      },
    ],
  },
  {
    key: "3",
    label: "3. Aspectos do desenvolvimento cognitivo",
    max: 70, // PROC!C26
    subsections: [
      {
        key: "3a",
        label: "3a. Formas de manipulação dos objetos",
        mode: "multi",
        max: 15,
        items: [
          { key: "nao_interessa", label: "Não se interessa pelos objetos", options: [{ key: "on", label: "Marcado", value: 0 }] },
          { key: "desiste_obstaculo", label: "Desiste de atividade quando surge algum obstáculo", options: [{ key: "on", label: "Marcado", value: 0 }] },
          { key: "poucas_acoes", label: "Explora os objetos por meio de poucas ações", options: [{ key: "on", label: "Marcado", value: 1 }] },
          { key: "rapida_superficial", label: "Explora os objetos de forma rápida e superficial", options: [{ key: "on", label: "Marcado", value: 1 }] },
          { key: "repetitivo_um_a_um", label: "Explora os objetos um a um de modo repetitivo", options: [{ key: "on", label: "Marcado", value: 1 }] },
          { key: "persiste_obstaculo", label: "Persiste na atividade quando surge algum obstáculo, tentando superá-lo", options: [{ key: "on", label: "Marcado", value: 2 }] },
          { key: "diversificado_relacao", label: "Atua, de modo repetitivo, sobre dois ou mais objetos ao mesmo tempo relacionando-os", options: [{ key: "on", label: "Marcado", value: 2 }] },
          { key: "diversificado_um_a_um", label: "Explora os objetos um a um de modo diversificado", options: [{ key: "on", label: "Marcado", value: 5 }] },
          { key: "diversificado_dois_mais", label: "Atua, de maneira diversificada, sobre dois ou mais objetos ao mesmo tempo relacionando-os", options: [{ key: "on", label: "Marcado", value: 10 }] },
        ],
      },
      {
        key: "3b",
        label: "3b. Nível de desenvolvimento do simbolismo",
        mode: "multi",
        max: 20,
        items: [
          { key: "sensorio_motor", label: "Não apresenta condutas simbólicas, somente sensório-motoras", options: [{ key: "on", label: "Marcado", value: 0 }] },
          { key: "uso_convencional", label: "Faz uso convencional dos objetos", options: [{ key: "on", label: "Marcado", value: 1 }] },
          { key: "esquemas_proprio_corpo", label: "Apresenta esquemas simbólicos (no próprio corpo)", options: [{ key: "on", label: "Marcado", value: 2 }] },
          { key: "bonecos_parceiros", label: "Usa bonecos ou outros parceiros no brinquedo simbólico", options: [{ key: "on", label: "Marcado", value: 3 }] },
          { key: "sequencia_simbolica", label: "Organiza ações simbólicas em uma sequência", options: [{ key: "on", label: "Marcado", value: 4 }] },
          { key: "objetos_substitutos", label: "Cria símbolos fazendo uso de objetos substitutos ou gestos simbólicos para representar objetos ausentes", options: [{ key: "on", label: "Marcado", value: 5 }] },
          { key: "linguagem_verbal_brinquedo", label: "Faz uso da linguagem verbal para relatar o que está acontecendo na situação de brinquedo", options: [{ key: "on", label: "Marcado", value: 5 }] },
        ],
      },
      {
        key: "3c",
        label: "3c. Nível de organização do brinquedo",
        mode: "multi",
        max: 15,
        items: [
          { key: "sem_organizacao", label: "Manipula os objetos sem uma organização dos mesmos", options: [{ key: "on", label: "Marcado", value: 0 }] },
          { key: "grupos_parciais", label: "Organiza as miniaturas em pequenos grupos, reproduzindo situações parciais, mas sem organizar todo o conjunto", options: [{ key: "on", label: "Marcado", value: 1 }] },
          { key: "agrupamentos_dois_tres", label: "Faz pequenos agrupamentos de dois ou três objetos (ex.: xícara ao lado da colher)", options: [{ key: "on", label: "Marcado", value: 1 }] },
          { key: "enfileira", label: "Enfileira os objetos (coloca um ao lado do outro, como se fizesse uma fila ou linha)", options: [{ key: "on", label: "Marcado", value: 2 }] },
          { key: "comodos_casa", label: "Organiza os objetos distribuindo-os de modo a configurar os diversos cômodos da casa", options: [{ key: "on", label: "Marcado", value: 3 }] },
          { key: "categorias", label: "Agrupa os objetos em categorias definidas, formando classes", options: [{ key: "on", label: "Marcado", value: 4 }] },
          { key: "tentativa_erro", label: "Seria os objetos por tentativa e erro (ex.: do maior para o menor)", options: [{ key: "on", label: "Marcado", value: 4 }] },
          { key: "criterio_diferencas", label: "Seria os objetos de acordo com as diferenças, seguindo um critério", options: [{ key: "on", label: "Marcado", value: 5 }] },
        ],
      },
      {
        key: "3d",
        label: "3d. Imitação",
        mode: "multi",
        max: 20,
        items: [
          { key: "gestual_nao_reage", label: "Imitação gestual — não reage às solicitações", options: [{ key: "on", label: "Marcado", value: 0 }] },
          { key: "gestual_visivel", label: "Imitação de gestos/movimentos visíveis no próprio corpo (derrubar duas canecas empilhadas, palpar esponja de banho)", options: [{ key: "on", label: "Marcado", value: 1 }] },
          { key: "gestual_nao_visivel", label: "Imitação de gestos/movimentos não visíveis no próprio corpo (segurar a orelha com uma das mãos, mostrar a língua)", options: [{ key: "on", label: "Marcado", value: 3 }] },
          { key: "sonora_nao_reage", label: "Imitação sonora — não reage às solicitações", options: [{ key: "on", label: "Marcado", value: 0 }] },
          { key: "sonora_silabas", label: "Imitação de sílabas", options: [{ key: "on", label: "Marcado", value: 2 }] },
          { key: "sonora_onomatopeias", label: "Imitação de onomatopeias", options: [{ key: "on", label: "Marcado", value: 3 }] },
          { key: "sonora_palavras", label: "Imitação de palavras", options: [{ key: "on", label: "Marcado", value: 5 }] },
          { key: "sonora_frases", label: "Imitação de frases", options: [{ key: "on", label: "Marcado", value: 6 }] },
        ],
      },
    ],
  },
];

// Bloco "Características gerais" (PROC!B75:F82) — não pontuado, cinco
// checklists de texto livre usados só para compor o relatório.
export const PROC_GENERAL_CHECKLISTS: { key: string; label: string; options: string[] }[] = [
  {
    key: "habilidades_comunicativas",
    label: "Características gerais das habilidades comunicativas",
    options: [
      "não apresenta comunicação intencional",
      "comunicação intencional com funções primárias por meios não simbólicos",
      "comunicação intencional plurifuncional, ampla participação em atividade dialógica por meios não simbólicos e não verbais",
      "comunicação intencional plurifuncional, ampla participação em atividade dialógica por meios simbólicos e não verbais",
      "comunicação intencional com funções primárias, restrita participação em atividade dialógica por meios verbais",
      "comunicação intencional plurifuncional, ampla participação em atividade dialógica por meios verbais",
      "comunicação intencional plurifuncional, ampla participação em atividade dialógica por meios verbais, não ligados ao contexto imediato",
    ],
  },
  {
    key: "organizacao_linguistica",
    label: "Características gerais da organização linguística",
    options: [
      "não apresenta organização linguística",
      "produção de palavras isoladas",
      "produção de enunciados (duas ou mais palavras organizadas no nível da frase)",
      "produção de discurso (frases encadeadas)",
    ],
  },
  {
    key: "compreensao_linguagem_oral",
    label: "Características gerais da compreensão da linguagem oral",
    options: [
      "não demonstra compreensão da linguagem oral",
      "responde não sistematicamente",
      "compreende ordens com até duas ações, ligadas ao contexto imediato",
      "compreende ordens com 3 ou mais ações, não ligados ao contexto imediato",
    ],
  },
  {
    key: "imitacao",
    label: "Características gerais da imitação",
    options: [
      "imitação gestual — não responde às solicitações",
      "imita somente gestos visíveis no próprio corpo",
      "imita gestos visíveis e não visíveis no próprio corpo",
      "imitação sonora — não responde às solicitações",
      "imita somente sons não verbais",
      "imita sons verbais e não verbais",
    ],
  },
  {
    key: "desenvolvimento_cognitivo",
    label: "Características gerais do desenvolvimento cognitivo",
    options: [
      "sensório-motor — fases iniciais",
      "sensório-motor — fases avançadas",
      "transição entre sensório-motor e representativo",
      "representativo",
    ],
  },
];

/**
 * Valores de referência publicados em Hage SRV, Pereira TC, Zorzi JL.
 * "Protocolo de Observação Comportamental — PROC: valores de referência
 * para uma análise quantitativa." Rev. CEFAC. 2012 Jul-Ago;14(4):677-690.
 * Amostra pequena (27 crianças de 2 anos, 17 de 3 anos) e os próprios
 * autores registram que "não é ainda suficiente para obter uma
 * normatização" — usar só como referência exibida ao lado do resultado,
 * nunca como tabela normativa oficial.
 */
export const PROC_REFERENCE_VALUES: Record<
  "2anos" | "3anos",
  {
    label: string;
    n: number;
    habilidadesComunicativas: { media: number; p25: number; p75: number };
    compreensaoLinguagemOral: { media: number; p25: number; p75: number };
    desenvolvimentoCognitivo: { media: number; p25: number; p75: number };
    total: { media: number; p25: number; p75: number };
  }
> = {
  "2anos": {
    label: "2 anos (24–35 meses)",
    n: 27,
    habilidadesComunicativas: { media: 51.44, p25: 49, p75: 55 },
    compreensaoLinguagemOral: { media: 50.7, p25: 45, p75: 60 },
    desenvolvimentoCognitivo: { media: 31.96, p25: 27, p75: 40.5 },
    total: { media: 137.11, p25: 127.5, p75: 154.5 },
  },
  "3anos": {
    label: "3 anos (36–47 meses)",
    n: 17,
    habilidadesComunicativas: { media: 58.12, p25: 55, p75: 60 },
    compreensaoLinguagemOral: { media: 59.41, p25: 60, p75: 60 },
    desenvolvimentoCognitivo: { media: 44.53, p25: 42, p75: 48 },
    total: { media: 162.06, p25: 158, p75: 170 },
  },
};

export const PROC_SCALE_012 = SCALE_012;
