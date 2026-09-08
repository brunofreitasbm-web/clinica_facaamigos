export const ROLES = [
  "gestor",
  "supervisor",
  "terapeuta",
  "recepcao",
  "faturamento",
  "responsavel",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  gestor: "Gestor",
  supervisor: "Supervisão",
  terapeuta: "Terapeuta",
  recepcao: "Recepção",
  faturamento: "Faturamento",
  responsavel: "Família",
};

export const ROLE_HOME: Record<Role, string> = {
  gestor: "/gestor",
  supervisor: "/supervisao",
  terapeuta: "/terapeuta",
  recepcao: "/recepcao",
  faturamento: "/faturamento",
  responsavel: "/familia",
};

/**
 * Prefixos de rota que cada papel pode abrir, além da própria home
 * (`ROLE_HOME`). O guard em `lib/supabase/middleware.ts` libera qualquer
 * caminho que comece por um destes prefixos; fora daqui, redireciona pra
 * home. `gestor` não usa esta lista — é isento do guard (acessa tudo).
 *
 * As exceções abaixo existem porque algumas telas seguem em módulo
 * diferente do papel que as opera no dia a dia (ex.: supervisão precisa
 * abrir a ficha do paciente da recepção e os relatórios do terapeuta a
 * partir do painel de Fluxos; faturamento precisa ver o código de
 * prestador cadastrado em Convênios pra gerar guia TISS, e abrir a ficha
 * do paciente a partir dos links "ver paciente" do próprio módulo de
 * faturamento/guias).
 */
export const ROLE_ALLOWED_PREFIXES: Record<Role, string[]> = {
  gestor: [],
  // A aba Fluxos da Supervisão (app/supervisao/fluxos-panel.tsx) é uma
  // trilha de atalhos deliberada por cima de quase todo o dia a dia da
  // Recepção (agenda, ficha do paciente, fila de WhatsApp, documentos,
  // pendências) e dos relatórios do Terapeuta — por isso o acesso é ao
  // módulo inteiro, não a subcaminhos avulsos.
  supervisor: [
    "/supervisao",
    "/recepcao",
    "/terapeuta/paciente",
    "/gestor/cadastros/salas",
    "/gestor/cadastros/comportamentos",
  ],
  terapeuta: ["/terapeuta"],
  recepcao: ["/recepcao"],
  faturamento: ["/faturamento", "/gestor/cadastros/convenios", "/recepcao/pacientes"],
  responsavel: ["/familia"],
};
