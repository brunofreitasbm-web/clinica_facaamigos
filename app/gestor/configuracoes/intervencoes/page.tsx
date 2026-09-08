import { redirect } from "next/navigation";

// Movido para Cadastros — catálogo clínico, não parâmetro de sistema
// (ver app/gestor/cadastros/intervencoes).
export default function IntervencoesRedirect() {
  redirect("/gestor/cadastros/intervencoes");
}
