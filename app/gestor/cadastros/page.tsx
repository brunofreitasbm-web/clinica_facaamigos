import { redirect } from "next/navigation";

// A antiga tela de abas somente-leitura foi substituída por uma seção com
// sidebar própria (ver cadastros-sidebar.tsx), no mesmo padrão de
// /gestor/configuracoes. Pacientes é o primeiro item.
export default function CadastrosPage() {
  redirect("/gestor/cadastros/pacientes");
}
