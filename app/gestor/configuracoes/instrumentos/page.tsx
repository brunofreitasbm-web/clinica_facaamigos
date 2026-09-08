import { redirect } from "next/navigation";

// Movido para Cadastros — catálogo clínico, não parâmetro de sistema
// (ver app/gestor/cadastros/instrumentos).
export default function InstrumentosRedirect() {
  redirect("/gestor/cadastros/instrumentos");
}
