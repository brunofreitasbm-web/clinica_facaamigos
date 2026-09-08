import { redirect } from "next/navigation";

// Movido para Cadastros (ver app/gestor/cadastros/terapias).
export default function ProtocolosRedirect() {
  redirect("/gestor/cadastros/terapias");
}
