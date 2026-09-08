import { redirect } from "next/navigation";

// Movido para Cadastros (ver app/gestor/cadastros/terapias/[protocolId]).
export default async function ProtocoloRedirect({
  params,
}: {
  params: Promise<{ protocolId: string }>;
}) {
  const { protocolId } = await params;
  redirect(`/gestor/cadastros/terapias/${protocolId}`);
}
