import { redirect } from "next/navigation";

// Movido para Cadastros — catálogo clínico, não parâmetro de sistema
// (ver app/gestor/cadastros/comportamentos).
export default function ComportamentosRedirect() {
  redirect("/gestor/cadastros/comportamentos");
}
