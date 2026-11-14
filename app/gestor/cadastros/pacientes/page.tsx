import { redirect } from "next/navigation";

// Pacientes saiu de Cadastros: agora e o menu proprio /gestor/pacientes.
export default function CadastrosPacientesRedirect() {
  redirect("/gestor/pacientes");
}
