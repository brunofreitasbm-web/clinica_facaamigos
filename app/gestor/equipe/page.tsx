import { redirect } from "next/navigation";

/**
 * Colaboradores & Contas mudou de módulo: é cadastro de entidade da clínica
 * (quem), não parâmetro de sistema, então foi pra dentro de
 * /gestor/cadastros (ver app/gestor/cadastros/cadastros-sidebar.tsx), como
 * pacientes, convênios etc. A rota antiga continua redirecionando pra não
 * quebrar link salvo/favorito.
 */
export default function EquipePage() {
  redirect("/gestor/cadastros/colaboradores");
}
