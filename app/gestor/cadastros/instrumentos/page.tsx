import { redirect } from "next/navigation";

// Unificado em Protocolos (ver app/gestor/cadastros/protocolos).
export default function InstrumentosRedirect() {
  redirect("/gestor/cadastros/protocolos");
}
