import { redirect } from "next/navigation";

// Movido para Cadastros (ver app/gestor/cadastros/convenios/[insurerId]/precos).
export default async function ConveniosPrecosRedirect({
  params,
}: {
  params: Promise<{ insurerId: string }>;
}) {
  const { insurerId } = await params;
  redirect(`/gestor/cadastros/convenios/${insurerId}/precos`);
}
