import { redirect } from "next/navigation";

// Movido para Cadastros (ver app/gestor/cadastros/terapias/nova).
export default function ProtocolosNovaRedirect() {
  redirect("/gestor/cadastros/terapias/nova");
}
