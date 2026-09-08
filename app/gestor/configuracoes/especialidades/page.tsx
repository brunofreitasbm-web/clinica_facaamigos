import { redirect } from "next/navigation";

// Movido para Cadastros — especialidades são um cadastro da clínica, não um
// parâmetro de sistema (ver app/gestor/cadastros/especialidades).
export default function EspecialidadesRedirect() {
  redirect("/gestor/cadastros/especialidades");
}
