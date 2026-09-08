import { SectionSidebar } from "@/components/section-sidebar";

// Só parâmetros de sistema ficam aqui — quem mexe é o gestor, mas o que se
// configura não é uma entidade da clínica (isso é Cadastros, ver
// app/gestor/cadastros/cadastros-sidebar.tsx): são regras, contas e
// integrações do próprio sistema.
const SIDEBAR_ITEMS = [
  { key: "prioridades", label: "Regras de Agendamento", href: "/gestor/configuracoes/prioridades-avaliacao" },
  { key: "profissionais", label: "Contratos & Valor-hora", href: "/gestor/configuracoes/profissionais" },
  { key: "usuarios", label: "Usuários & Permissões", href: "/gestor/configuracoes/usuarios" },
  { key: "notificacoes", label: "WhatsApp Bot", href: "/gestor/configuracoes/notificacoes" },
] as const;

export type ConfigSidebarKey = (typeof SIDEBAR_ITEMS)[number]["key"];

export function ConfigSidebar({ active }: { active: ConfigSidebarKey }) {
  return <SectionSidebar title="Sistema" items={SIDEBAR_ITEMS} active={active} />;
}
