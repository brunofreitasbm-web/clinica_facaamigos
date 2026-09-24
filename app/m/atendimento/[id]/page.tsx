import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAtendimentoAccess, loadAtendimentoData } from "@/lib/atendimento/load-data";
import { MobileShell } from "../mobile-shell";

export const dynamic = "force-dynamic";

/**
 * Rota dedicada pra uma conversa aberta (/m/atendimento/[id]) — existe pra o
 * botão "voltar" do Android fechar o chat e retornar à fila em vez de sair
 * do app, em vez de guardar a seleção só em estado de cliente.
 */
export default async function MobileAtendimentoConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { userId, allowed } = await getAtendimentoAccess(supabase);
  if (!userId) redirect("/login");
  if (!allowed) redirect("/login");

  const { conversations, staffNames, insurerById } = await loadAtendimentoData(supabase);

  return (
    <MobileShell
      initialConversations={conversations}
      staffNames={staffNames}
      insurerById={insurerById}
      currentUserId={userId}
      initialSelectedId={id}
    />
  );
}
