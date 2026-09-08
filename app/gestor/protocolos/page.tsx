import { redirect } from "next/navigation";

// Unificado em Cadastros (ver app/gestor/cadastros/protocolos).
export default function ProtocolosRedirect() {
  redirect("/gestor/cadastros/protocolos");
}
