import { redirect } from "next/navigation";

// Movido para Cadastros — salas e recursos são cadastro da clínica, não
// parâmetro de sistema (ver app/gestor/cadastros/salas).
export default function AtendimentosConfigRedirect() {
  redirect("/gestor/cadastros/salas");
}
