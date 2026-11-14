// lib/recepcao-attention-pure.ts

/**
 * "Precisa de você agora" na home da recepção (regra 5 do AGENTS.md: a tela traz
 * o trabalho). Só entra o que exige ação, na ordem de urgência: quem está
 * fisicamente esperando vem antes de quem espera por mensagem, que vem antes de
 * prazo e de pendência de cadastro. Quantidade zero some; tudo zerado = "em dia".
 */
export type AttentionKey = "chegadas" | "familias" | "guias" | "pendencias";

export type AttentionItem = {
  key: AttentionKey;
  count: number;
  label: string;
  /** Texto do botão, sempre um verbo: o operador sabe o que acontece ao clicar. */
  action: string;
  href: string;
};

export type AttentionCounts = Record<AttentionKey, number>;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function buildAttentionItems(counts: AttentionCounts): AttentionItem[] {
  const items: AttentionItem[] = [
    {
      key: "chegadas",
      count: counts.chegadas,
      label: `${plural(counts.chegadas, "pessoa chegou", "pessoas chegaram")} pelo QR e ${counts.chegadas === 1 ? "espera" : "esperam"} confirmação`,
      action: "Confirmar",
      href: "/recepcao/chegadas",
    },
    {
      key: "familias",
      count: counts.familias,
      label: `${plural(counts.familias, "família nova", "famílias novas")} na Fila de entrada`,
      action: "Abrir fila",
      href: "/recepcao/fila",
    },
    {
      key: "guias",
      count: counts.guias,
      label: `${plural(counts.guias, "paciente com guia", "pacientes com guia")} vencendo ou acabando`,
      action: "Renovar",
      href: "#guias-vencendo",
    },
    {
      key: "pendencias",
      count: counts.pendencias,
      label: `${plural(counts.pendencias, "pendência", "pendências")} de cadastro`,
      action: "Resolver",
      href: "/recepcao/pacientes/pendencias",
    },
  ];
  return items.filter((i) => i.count > 0);
}
