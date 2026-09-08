/**
 * Escala Labirinto de Comportamento Alimentar — estrutura E itens
 * reproduzidos com atribuição (Creative Commons Attribution 4.0).
 *
 * Fonte: Lázaro, C. P.; Siquara, G. M.; Pondé, M. P. "Escala de Avaliação do
 * Comportamento Alimentar no Transtorno do Espectro Autista: estudo de
 * validação." Jornal Brasileiro de Psiquiatria, 68(4), 2019.
 * DOI: https://doi.org/10.1590/0047-2085000000246 — CC BY 4.0.
 *
 * Os 26 itens abaixo são transcrição literal do artigo (permitida pela
 * licença CC BY, mediante atribuição). Não editar o texto dos itens sem
 * conferir a fonte.
 */
import type { ProtocolTemplate } from "./types";

export const escalaLabirintoTemplate: ProtocolTemplate = {
  name: "escala_labirinto",
  displayName: "Escala Labirinto — Comportamento Alimentar (CC BY 4.0)",
  version: "1.0",
  scale: { max: 4, labels: { 0: "Não", 1: "Raramente", 2: "Às vezes", 3: "Frequentemente", 4: "Sempre" } },
  contentLicense: "cc-by",
  attribution:
    "Lázaro, C. P.; Siquara, G. M.; Pondé, M. P. (2019). Escala de Avaliação do Comportamento Alimentar no Transtorno do Espectro Autista: estudo de validação. Jornal Brasileiro de Psiquiatria, 68(4). https://doi.org/10.1590/0047-2085000000246 — CC BY 4.0.",
  sources: ["https://www.scielo.br/j/jbpsiq/a/qwqxWxDcg97YhnDJ36VKzFg/"],
  notes:
    "Itens reproduzidos integralmente do artigo original, licença CC BY 4.0. Escala de frequência 0-4; quanto maior, mais frequente o comportamento (itens de dificuldade). Respondido pelo cuidador.",
  domains: [
    {
      domain: "Motricidade na Mastigação",
      items: [
        { code: "MM-01", description: "Dificuldades para mastigar os alimentos" },
        { code: "MM-02", description: "Engole os alimentos sem mastigá-los o bastante" },
        { code: "MM-03", description: "Dificuldade para levar o alimento de um lado para o outro da boca com a língua" },
        { code: "MM-04", description: "Mastiga os alimentos com a boca aberta" },
      ],
    },
    {
      domain: "Seletividade Alimentar",
      items: [
        { code: "SA-01", description: "Evita comer vegetais cozidos e/ou crus" },
        { code: "SA-02", description: "Retira o tempero da comida" },
        { code: "SA-03", description: "Evita comer frutas" },
      ],
    },
    {
      domain: "Habilidades nas Refeições",
      items: [
        { code: "HR-01", description: "Possui inquietação/agitação motora que dificulta sentar-se à mesa" },
        { code: "HR-02", description: "Tem dificuldades de sentar-se à mesa para fazer as refeições" },
        { code: "HR-03", description: "Tem dificuldades de utilizar os talheres e outros utensílios" },
        { code: "HR-04", description: "Derrama muito a comida na mesa ou na roupa quando se alimenta" },
        { code: "HR-05", description: "Bebe, come, lambe substâncias ou objetos estranhos" },
      ],
    },
    {
      domain: "Comportamento Inadequado relacionado às Refeições",
      items: [
        { code: "CI-01", description: "Vomita, durante ou imediatamente após as refeições" },
        { code: "CI-02", description: "Durante ou imediatamente após as refeições, golfa e mastiga o alimento novamente" },
      ],
    },
    {
      domain: "Comportamentos Rígidos relacionados à Alimentação",
      items: [
        { code: "CR-01", description: "Come sempre com os mesmos utensílios" },
        { code: "CR-02", description: "Come sempre no mesmo lugar" },
        { code: "CR-03", description: "Quer comer sempre os mesmos alimentos" },
        { code: "CR-04", description: "Quer comer alimentos com cor semelhante" },
        { code: "CR-05", description: "Quer comer alimentos sempre da mesma marca, embalagem ou personagem" },
        { code: "CR-06", description: "Possui ritual para comer" },
      ],
    },
    {
      domain: "Comportamento Opositor relacionado à Alimentação",
      items: [
        { code: "CO-01", description: "Sem permissão, pega a comida fora do horário das refeições" },
        { code: "CO-02", description: "Sem permissão, pega a comida de outras pessoas durante as refeições" },
        { code: "CO-03", description: "Come uma grande quantidade de alimento num período de tempo curto" },
      ],
    },
    {
      domain: "Alergias e Intolerância Alimentar",
      items: [
        { code: "AI-01", description: "Intolerância ao glúten" },
        { code: "AI-02", description: "Alergia alimentar" },
        { code: "AI-03", description: "Tem intolerância à lactose" },
      ],
    },
  ],
};

export default escalaLabirintoTemplate;
