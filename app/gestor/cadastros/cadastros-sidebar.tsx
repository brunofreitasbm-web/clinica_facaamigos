import { SectionSidebar } from "@/components/section-sidebar";

// Tudo aqui é entidade da clínica (quem, o quê, onde) — o oposto de
// Configurações (parâmetros de sistema, ver
// app/gestor/configuracoes/config-sidebar.tsx).
const SIDEBAR_ITEMS = [
  { key: "pacientes", label: "Pacientes", href: "/gestor/cadastros/pacientes" },
  { key: "colaboradores", label: "Colaboradores & Contas", href: "/gestor/cadastros/colaboradores" },
  { key: "convenios", label: "Planos de Saúde", href: "/gestor/cadastros/convenios" },
  { key: "precos-particulares", label: "Preços Particulares", href: "/gestor/cadastros/precos-particulares" },
  { key: "tipos-atendimento", label: "Tipos de Atendimento", href: "/gestor/cadastros/tipos-atendimento" },
  { key: "protocolos", label: "Protocolos", href: "/gestor/cadastros/protocolos" },
  { key: "especialidades", label: "Especialidades", href: "/gestor/cadastros/especialidades" },
  { key: "comportamentos", label: "Comportamentos-alvo", href: "/gestor/cadastros/comportamentos" },
  { key: "modalidades-at", label: "Modalidades de AT", href: "/gestor/cadastros/modalidades-at" },
  { key: "intervencoes", label: "Intervenções", href: "/gestor/cadastros/intervencoes" },
  { key: "pts-templates", label: "Templates do PTS", href: "/gestor/cadastros/pts-templates" },
  { key: "salas", label: "Salas & Recursos", href: "/gestor/cadastros/salas" },
  { key: "estoque", label: "Estoque & Almoxarifado", href: "/gestor/cadastros/estoque" },
] as const;

export function CadastrosSidebar() {
  return <SectionSidebar title="Clínica" items={SIDEBAR_ITEMS} />;
}
