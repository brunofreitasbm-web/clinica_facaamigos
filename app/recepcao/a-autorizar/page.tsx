import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getReceptionQueue, isAuthorizationQueueItem } from "@/lib/reception-queue";
import { dropLeadsWithClosedChat } from "@/lib/closed-chat-filter";
import { buildWorkspaceItems } from "../pacientes/pendencias/queue-items";
import { AuthorizationsWorkspace } from "./authorizations-workspace";
import { isIntakeGroup, legacyTab } from "./intake-filters-pure";
import { ShieldCheck, ArrowRight, CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * "Fila de entrada" (antes "Autorizações"): lead do WhatsApp com documentos completos que ainda não passou pelo
 * plano de saúde — documentos e dados captados pelo bot, mais a linha do tempo da
 * autorização (guia enviada → plano autorizou → habilitar agendamento). É o
 * mesmo painel de contato da Fila de pendências (DraftIntakeCard), só que
 * com 4 abas (agir agora, aguardando família, aguardando plano, concluídos).
 */
export default async function AAutorizarPage({
  searchParams,
}: {
  searchParams: Promise<{
    item?: string;
    q?: string;
    aba?: string;
    status?: string;
    meus?: string;
    etapa?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const authorizationQueue = (await getReceptionQueue(supabase)).filter(isAuthorizationQueueItem);

  // Cruza com o chat: lead com conversa já encerrada e sem guia andando sai do painel
  // (volta sozinho se a família escrever de novo).
  const { visible: queue, hiddenCount: hiddenByClosedChat } = await dropLeadsWithClosedChat(supabase, authorizationQueue);

  const { data: reassignCandidates } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("active", true)
    .in("role", ["recepcao", "supervisor", "gestor"])
    .order("full_name", { ascending: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const items = buildWorkspaceItems(queue, { reassignCandidates, userId: user?.id ?? null });
  const requestedItem = params.item && queue.some((item) => item.id === params.item) ? params.item : null;

  // ?aba= escolhe a aba; ?etapa= e ?status= (links antigos) caem na aba equivalente.
  const initialTab = isIntakeGroup(params.aba) ? params.aba : legacyTab({ etapa: params.etapa, status: params.status });

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Fila de entrada" />
      <PageContainer className="gap-5">
        {queue.length === 0 ? (
          <div className="my-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center shadow-2xs">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-xs">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="m-0 text-xl font-bold text-slate-800">Nenhuma autorização pendente</h2>
            <p className="m-0 mt-2 max-w-md text-sm text-slate-600">
              Todos os contatos do WhatsApp foram processados ou já possuem guia autorizada.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/recepcao/pacientes/pendencias"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <span>Ver fila geral de pendências</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/recepcao"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                <span>Ir para Agenda do dia</span>
              </Link>
            </div>
          </div>
        ) : (
          <AuthorizationsWorkspace
            items={items}
            queue={queue}
            nowIso={new Date().toISOString()}
            hiddenCount={hiddenByClosedChat}
            initial={{
              q: params.q ?? "",
              tab: initialTab,
              mine: params.meus === "1",
              item: requestedItem,
            }}
          />
        )}
      </PageContainer>
    </main>
  );
}
