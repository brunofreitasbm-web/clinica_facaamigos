import { SectionSidebar } from "@/components/section-sidebar";

// Só parâmetros de sistema ficam aqui — quem mexe é o gestor, mas o que se
// configura não é uma entidade da clínica (isso é Cadastros, ver
// app/gestor/cadastros/cadastros-sidebar.tsx): são regras, contas e
// integrações do próprio sistema.
//
// "Usuários & Permissões" aponta direto pra /gestor/equipe (10/09/2026).
// Antes apontava pra /gestor/configuracoes/usuarios, que é só um redirect
// server-side pra lá: o clique começava uma navegação pra Configurações e
// terminava no módulo Equipe, sem aviso e com um round-trip a mais. A rota
// antiga continua redirecionando (compat de link salvo), mas saiu do
// caminho do clique — e o item ganha a marca de cross-link, igual ao
// "Terapeutas" de Cadastros.
const SIDEBAR_ITEMS = [
  { key: "dados-da-clinica", label: "Dados da Clínica", href: "/gestor/configuracoes/dados-da-clinica" },
  { key: "prioridades", label: "Regras de Agendamento", href: "/gestor/configuracoes/prioridades-avaliacao" },
  { key: "profissionais", label: "Contratos & Valor-hora", href: "/gestor/configuracoes/profissionais" },
  { key: "usuarios", label: "Usuários & Permissões", href: "/gestor/equipe", external: true },
  { key: "cupom-checkin", label: "Cupom de Check-in", href: "/gestor/configuracoes/cupom-checkin" },
] as const;

export function ConfigSidebar() {
  return <SectionSidebar title="Sistema" items={SIDEBAR_ITEMS} />;
}
