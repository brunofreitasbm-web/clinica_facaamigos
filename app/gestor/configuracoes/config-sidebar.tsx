import { SectionSidebar } from "@/components/section-sidebar";

// Só parâmetros de sistema ficam aqui — quem mexe é o gestor, mas o que se
// configura não é uma entidade da clínica (isso é Cadastros, ver
// app/gestor/cadastros/cadastros-sidebar.tsx): são regras, contas e
// integrações do próprio sistema.
const SIDEBAR_ITEMS = [
  { key: "dados-da-clinica", label: "Dados da Clínica", href: "/gestor/configuracoes/dados-da-clinica" },
  { key: "prioridades", label: "Regras de Agendamento", href: "/gestor/configuracoes/prioridades-avaliacao" },
  { key: "profissionais", label: "Contratos & Valor-hora", href: "/gestor/configuracoes/profissionais" },
  { key: "usuarios", label: "Usuários & Permissões", href: "/gestor/configuracoes/usuarios" },
  { key: "cupom-checkin", label: "Cupom de Check-in", href: "/gestor/configuracoes/cupom-checkin" },
] as const;

export type ConfigSidebarKey = (typeof SIDEBAR_ITEMS)[number]["key"];

export function ConfigSidebar({ active }: { active: ConfigSidebarKey }) {
  return <SectionSidebar title="Sistema" items={SIDEBAR_ITEMS} active={active} />;
}
