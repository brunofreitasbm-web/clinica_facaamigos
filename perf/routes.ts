// Catálogo de rotas do benchmark — todas acessíveis pelo perfil `gestor`
// (sem restrição de ROLE_ALLOWED_PREFIXES, ver lib/roles.ts). `ready` é um
// seletor que só existe depois que o DADO real chegou — nunca um texto que
// já aparece no skeleton/loading.tsx, senão o benchmark "melhora" só porque
// o skeleton pinta rápido, sem o conteúdo real ter ficado mais rápido.
export type RouteSpec = {
  path: string;
  label: string;
  ready: string;
};

export const ROUTES: RouteSpec[] = [
  { path: "/gestor", label: "Gestor (painel)", ready: "text=Vazamento 1" },
  { path: "/gestor/inteligencia", label: "Gestor > Inteligência", ready: "text=Pacientes por Plano de Saúde" },
  { path: "/gestor/financeiro", label: "Gestor > Financeiro", ready: "text=Receita" },
  { path: "/recepcao", label: "Recepção (agenda do dia)", ready: "text=Agenda do dia" },
  { path: "/recepcao/pacientes", label: "Recepção > Pacientes", ready: "text=Novo paciente" },
  { path: "/supervisao", label: "Supervisão (Coordenação)", ready: "body" },
  { path: "/terapeuta", label: "Terapeuta (agenda)", ready: "body" },
  { path: "/faturamento", label: "Faturamento", ready: "body" },
];
