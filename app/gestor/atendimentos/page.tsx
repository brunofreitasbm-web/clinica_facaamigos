import { redirect } from "next/navigation";

// Movido para Cadastros — tipos de atendimento são cadastro da clínica
// (ver app/gestor/cadastros/tipos-atendimento).
export default function AtendimentosRedirect() {
  redirect("/gestor/cadastros/tipos-atendimento");
}
