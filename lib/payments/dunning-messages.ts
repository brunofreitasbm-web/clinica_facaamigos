// lib/payments/dunning-messages.ts
// Textos da régua. PURO (sem `@/`), testado em tests/dunning-messages.test.ts.
// Regra: nunca citar terapia, diagnóstico, criança ou profissional (LGPD art. 11);
// só "Instituto Faça Amigos", valor, competência e vencimento.
import type { BillingMethod, DunningStep } from "./billing-pure.ts";

export type DunningContext = {
  name: string | null;
  amount: number;
  dueDate: string; // AAAA-MM-DD
  reference: string; // AAAA-MM-DD (competência)
  method: BillingMethod;
  link?: string | null;
  pixCode?: string | null;
};

export type DunningMessage = {
  category: "cobranca_lembrete" | "cobranca_atraso" | "cobranca_formal";
  subject: string;
  text: string;
  /** Variáveis do template aprovado: {{1}} nome, {{2}} valor, {{3}} vencimento, {{4}} competência. */
  variables: Record<string, string>;
};

const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const mY = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function dunningMessage(step: DunningStep, ctx: DunningContext): DunningMessage {
  const who = ctx.name?.trim().split(/\s+/)[0] || "Olá";
  const greet = ctx.name ? `Olá, ${who}!` : "Olá!";
  const value = brl(ctx.amount);
  const due = dmy(ctx.dueDate);
  const comp = mY(ctx.reference);
  const variables = { "1": who, "2": value, "3": due, "4": comp };
  const how =
    ctx.method === "pix_automatico"
      ? "O débito será feito automaticamente no seu Pix Automático."
      : ctx.link
        ? `Segunda via e pagamento: ${ctx.link}`
        : "Acesse o portal da família para a segunda via.";

  switch (step) {
    case "d_minus_5":
      return {
        category: "cobranca_lembrete",
        subject: `Mensalidade de ${comp} disponível`,
        text: `${greet} A mensalidade de ${comp} do Instituto Faça Amigos (${value}) vence em ${due}. ${how}`,
        variables,
      };
    case "d_minus_1":
      return {
        category: "cobranca_lembrete",
        subject: `Mensalidade vence amanhã (${due})`,
        text: `${greet} Lembrete: a mensalidade de ${comp} (${value}) vence amanhã, ${due}. ${how}`,
        variables,
      };
    case "d_plus_1":
      return {
        category: "cobranca_atraso",
        subject: `Não identificamos o pagamento de ${comp}`,
        text: `${greet} Não identificamos o pagamento da mensalidade de ${comp} (${value}), que venceu em ${due}. Se já pagou, desconsidere. ${how}`,
        variables,
      };
    case "d_plus_3":
      return {
        category: "cobranca_atraso",
        subject: `Mensalidade de ${comp} em atraso`,
        text: `${greet} A mensalidade de ${comp} (${value}) venceu em ${due}. Incidem multa de 2% e juros de 1% ao mês conforme o contrato. ${how}`,
        variables,
      };
    case "d_plus_10_formal":
      return {
        category: "cobranca_formal",
        subject: `Aviso: mensalidade de ${comp} em aberto`,
        text: `${greet} A mensalidade de ${comp} (${value}), vencida em ${due}, segue em aberto. Sem a regularização, não conseguiremos liberar a agenda do próximo mês. Fale conosco para combinarmos a melhor forma de resolver. ${how}`,
        variables,
      };
    default:
      // Passos humanos não geram mensagem automática; chamar com eles é erro de uso.
      throw new Error(`Passo ${step} não tem mensagem automática`);
  }
}
