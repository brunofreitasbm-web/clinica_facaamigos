import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReceptionQueue, isAuthorizationQueueItem } from "@/lib/reception-queue";

export const dynamic = "force-dynamic";

/**
 * A tela Pendências saiu do menu (04/11/2026): as pendências viraram pílulas ao
 * lado do nome na lista de Pacientes (/recepcao/pacientes). A rota fica só para
 * não quebrar links antigos:
 *  - ?lead=<draftId> (botão "Resolver pendências" do Atendimento): contato que
 *    ainda espera o plano vai para Autorizações; paciente com prontuário abre o
 *    diálogo de pendências dele em Pacientes (?abrir=<patientId>);
 *  - o resto vai para a lista de Pacientes.
 */
export default async function PendenciasRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const params = await searchParams;
  if (params.lead) {
    const supabase = await createClient();
    const queue = await getReceptionQueue(supabase);
    const item = queue.find((i) => i.draft?.id === params.lead);
    if (item) {
      if (isAuthorizationQueueItem(item)) redirect(`/recepcao/a-autorizar?item=${encodeURIComponent(item.id)}`);
      if (item.patientId) redirect(`/recepcao/pacientes?abrir=${encodeURIComponent(item.patientId)}`);
    }
  }
  redirect("/recepcao/pacientes");
}
