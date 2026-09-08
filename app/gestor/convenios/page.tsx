import { redirect } from "next/navigation";

// Movido para Cadastros (ver app/gestor/cadastros/convenios).
export default function ConveniosRedirect() {
  redirect("/gestor/cadastros/convenios");
}
