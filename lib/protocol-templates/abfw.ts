/**
 * Linguagem infantil por subtestes — estrutura tipo ABFW (genérico).
 *
 * A ESTRUTURA (quatro subtestes: fonologia, vocabulário, fluência e
 * pragmática, com seus campos conceituais, tipologia de disfluências e
 * funções comunicativas) reproduz o que é descrito em artigos de acesso
 * aberto. O TEXTO de cada item é original desta base e NÃO copia nem
 * parafraseia o teste ABFW (Pró-Fono) ou qualquer adaptação.
 *
 * Fontes da estrutura:
 * - https://www.scielo.br/j/acr/a/zz3yNMTHTGrCpS9ZpQG5SXC/?lang=pt
 * - http://www.scielo.br/j/pfono/a/MzMGPLdzwyty36gcJtjqknt/?lang=pt
 */
import type { ProtocolTemplate } from "./types";

const FON = "Fonologia";
const VOC = "Vocabulário";
const FLU = "Fluência";
const PRA = "Pragmática";

function vocabDomain(code: string, domain: string, exemplo: string) {
  return {
    level: VOC,
    domain,
    items: [
      { code: `VOC-${code}-01`, description: `Nomeia corretamente figuras do campo ${domain.toLowerCase()} (ex.: ${exemplo}) sem apoio.` },
      { code: `VOC-${code}-02`, description: `Quando não nomeia, usa substituição adequada do mesmo campo, gesto ou descrição de função.` },
    ],
  };
}

export const abfwTemplate: ProtocolTemplate = {
  name: "abfw",
  displayName: "Linguagem infantil por subtestes (estrutura tipo ABFW, genérico)",
  version: "1.0",
  scale: {
    max: 2,
    labels: { 0: "Não adequado", 1: "Parcial", 2: "Adequado" },
  },
  contentLicense: "original",
  sources: [
    "https://www.scielo.br/j/acr/a/zz3yNMTHTGrCpS9ZpQG5SXC/?lang=pt",
    "http://www.scielo.br/j/pfono/a/MzMGPLdzwyty36gcJtjqknt/?lang=pt",
  ],
  notes:
    "Fonologia: pontue 2 quando o processo está ausente na fala espontânea e na nomeação, 1 quando ocorre de forma esporádica, 0 quando é sistemático. Vocabulário: por campo conceitual, avalie nomeação e o tipo de substituição usada. Fluência: 2 = ausência ou baixa ocorrência do tipo de disfluência. Pragmática: registre em amostra de interação de cerca de 30 minutos se a função comunicativa e o meio aparecem de forma adequada à idade. Itens de texto original; a estrutura segue descrições publicadas em fontes abertas.",
  domains: [
    {
      level: FON,
      domain: "Processos fonológicos",
      items: [
        { code: "FON-PRO-01", description: "Não apresenta redução de sílaba: produz todas as sílabas de palavras com três ou mais sílabas." },
        { code: "FON-PRO-02", description: "Não apresenta harmonia consonantal: consoantes da palavra não se assemelham entre si por influência." },
        { code: "FON-PRO-03", description: "Não apresenta plosivação de fricativa: sons como /f/, /s/ e /ʃ/ não são trocados por /p/, /t/ e /k/." },
        { code: "FON-PRO-04", description: "Não apresenta posteriorização: sons anteriores como /t/ e /d/ não são produzidos como /k/ e /g/." },
        { code: "FON-PRO-05", description: "Não apresenta anteriorização: sons posteriores como /k/ e /g/ não são produzidos como /t/ e /d/." },
        { code: "FON-PRO-06", description: "Não apresenta simplificação de líquidas: /l/ e /r/ não são omitidos nem trocados por semivogais." },
        { code: "FON-PRO-07", description: "Não apresenta simplificação de encontro consonantal: grupos como /pr/ e /bl/ mantêm as duas consoantes." },
        { code: "FON-PRO-08", description: "Não apresenta simplificação de consoante final: /s/ e /r/ em final de sílaba são produzidos." },
        { code: "FON-PRO-09", description: "Não apresenta sonorização: consoantes surdas como /p/ e /s/ não são produzidas como /b/ e /z/." },
        { code: "FON-PRO-10", description: "Não apresenta ensurdecimento: consoantes sonoras como /b/ e /z/ não são produzidas como /p/ e /s/." },
        { code: "FON-PRO-11", description: "Não apresenta anteriorização de fricativa palatal: /ʃ/ e /ʒ/ não são produzidos como /s/ e /z/." },
        { code: "FON-PRO-12", description: "Não apresenta substituição de líquida não lateral por lateral: /r/ não é produzido como /l/." },
      ],
    },
    vocabDomain("VES", "Vestuário", "camisa, sapato, boné"),
    vocabDomain("ANI", "Animais", "gato, vaca, borboleta"),
    vocabDomain("ALI", "Alimentos", "pão, maçã, sorvete"),
    vocabDomain("TRA", "Meios de transporte", "ônibus, avião, bicicleta"),
    vocabDomain("MOV", "Móveis e utensílios", "cadeira, garfo, panela"),
    vocabDomain("PRO", "Profissões", "médico, professora, bombeiro"),
    vocabDomain("LUG", "Lugares", "praia, escola, mercado"),
    vocabDomain("FCO", "Formas e cores", "círculo, quadrado, vermelho"),
    vocabDomain("BRI", "Brinquedos e instrumentos musicais", "bola, boneca, tambor"),
    {
      level: FLU,
      domain: "Tipologia das disfluências",
      items: [
        { code: "FLU-TIP-01", description: "Ausência ou baixa ocorrência de hesitações, como pausas preenchidas com 'é' ou 'hum'." },
        { code: "FLU-TIP-02", description: "Ausência ou baixa ocorrência de interjeições inseridas no meio da frase, como 'tipo' e 'né'." },
        { code: "FLU-TIP-03", description: "Ausência ou baixa ocorrência de revisões, em que a criança reformula o que começou a dizer." },
        { code: "FLU-TIP-04", description: "Ausência ou baixa ocorrência de repetição de palavra inteira." },
        { code: "FLU-TIP-05", description: "Ausência ou baixa ocorrência de repetição de sílaba ou som inicial da palavra." },
        { code: "FLU-TIP-06", description: "Ausência ou baixa ocorrência de prolongamento de sons dentro da palavra." },
        { code: "FLU-TIP-07", description: "Ausência ou baixa ocorrência de bloqueios, com esforço visível para iniciar o som." },
        { code: "FLU-TIP-08", description: "Ausência ou baixa ocorrência de pausas longas e silenciosas no meio do enunciado." },
      ],
    },
    {
      level: FLU,
      domain: "Velocidade de fala",
      items: [
        { code: "FLU-VEL-01", description: "Quantidade de palavras por minuto dentro da faixa esperada para a idade em fala espontânea." },
        { code: "FLU-VEL-02", description: "Quantidade de sílabas por minuto dentro da faixa esperada para a idade em fala espontânea." },
      ],
    },
    {
      level: PRA,
      domain: "Funções comunicativas",
      items: [
        { code: "PRA-FUN-01", description: "Pedido de objeto: solicita um item desejado por fala, vocalização ou gesto." },
        { code: "PRA-FUN-02", description: "Pedido de ação: solicita que o adulto faça algo, como abrir ou ligar um brinquedo." },
        { code: "PRA-FUN-03", description: "Pedido de rotina social: solicita continuação de brincadeira interativa conhecida." },
        { code: "PRA-FUN-04", description: "Pedido de consentimento: busca permissão do adulto antes de realizar uma ação." },
        { code: "PRA-FUN-05", description: "Pedido de informação: faz perguntas para saber algo sobre objeto, pessoa ou evento." },
        { code: "PRA-FUN-06", description: "Protesto: recusa objeto ou ação de forma dirigida ao interlocutor." },
        { code: "PRA-FUN-07", description: "Reconhecimento do outro: cumprimenta, chama ou responde à presença do interlocutor." },
        { code: "PRA-FUN-08", description: "Exibição: mostra objeto ou ação ao adulto para chamar atenção sobre si." },
        { code: "PRA-FUN-09", description: "Comentário: faz observação sobre objeto ou evento presente, dirigida ao outro." },
        { code: "PRA-FUN-10", description: "Autorregulatório: usa fala para organizar a própria ação enquanto a realiza." },
        { code: "PRA-FUN-11", description: "Nomeação: identifica objetos ou figuras pelo nome sem que seja pedido." },
        { code: "PRA-FUN-12", description: "Performativo: produz sons ou falas que fazem parte da brincadeira, como onomatopeias." },
        { code: "PRA-FUN-13", description: "Exclamativo: expressa surpresa ou reação emocional a um evento." },
        { code: "PRA-FUN-14", description: "Reativo: responde a uma fala do interlocutor sem acrescentar informação nova." },
        { code: "PRA-FUN-15", description: "Não focalizado: produz fala ou vocalização sem direção clara a interlocutor ou objeto." },
        { code: "PRA-FUN-16", description: "Jogo: usa objetos em brincadeira funcional ou simbólica de forma organizada." },
        { code: "PRA-FUN-17", description: "Exploratório: investiga objetos ou o ambiente manipulando e observando." },
        { code: "PRA-FUN-18", description: "Narrativa: relata evento passado ou inventado com sequência de acontecimentos." },
        { code: "PRA-FUN-19", description: "Expressão de protesto: manifesta desagrado ou frustração sem dirigir ao interlocutor." },
        { code: "PRA-FUN-20", description: "Jogo compartilhado: envolve o adulto na brincadeira, alternando turnos e papéis." },
      ],
    },
    {
      level: PRA,
      domain: "Meio comunicativo",
      items: [
        { code: "PRA-MEI-01", description: "Meio verbal: usa palavras ou frases reconhecíveis para comunicar-se." },
        { code: "PRA-MEI-02", description: "Meio vocal: usa vocalizações sem palavras, como sons e entonação, com intenção." },
        { code: "PRA-MEI-03", description: "Meio gestual: usa apontar, mostrar, olhar dirigido e gestos convencionais." },
      ],
    },
  ],
};

export default abfwTemplate;
