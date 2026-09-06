import { redirect } from "next/navigation";

export default function ServicosPageRedirect() {
  redirect("/gestor/configuracoes/gerais");
}
