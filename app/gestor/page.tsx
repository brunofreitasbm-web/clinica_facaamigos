import { redirect } from "next/navigation";

// O módulo Gestão abre direto na Inteligência BI. Esta rota (/gestor) só
// existe para os links antigos (menu do usuário, marca do módulo, Sidebar):
// redireciona para a home do módulo em vez de renderizar um painel separado.
export default function GestorPage() {
  redirect("/gestor/inteligencia");
}
