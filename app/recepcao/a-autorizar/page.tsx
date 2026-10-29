import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getReceptionQueue, isAuthorizationQueueItem } from "@/lib/reception-queue";
import { buildWorkspaceItems } from "../pacientes/pendencias/queue-items";
import { AuthorizationsWorkspace, type AuthFilterStatus, type AuthFilterPendency, type AuthFilterForwarding } from "./authorizations-workspace";
import { ShieldCheck, ArrowRight, CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * "Autorizações": lead do WhatsApp com documentos completos que ainda não passou pelo
 * plano de saúde — documentos e dados captados pelo bot, mais a linha do tempo da
 * autorização (guia enviada → plano autorizou → habilitar agendamento). É o
 * mesmo painel de contato da Fila de pendências (DraftIntakeCard), só que
 * com sistema especializado de filtros, separação de não tratados e quadros retráteis.
 */
export default async function AAutorizarPage({
  searchParams,
}: {
  searchParams: Promise<{
    item?: string;
    q?: string;
    status?: string;
    pendencia?: string;
    encaminhamento?: string;
    dono?: string;
    meus?: string;
    etapa?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const queue = (await getReceptionQueue(supabase)).filter(isAuthorizationQueueItem);

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

  // Normalização de status legado de ?etapa=docs / ?etapa=autorizacao / ?etapa=agendar
  let initialStatus: AuthFilterStatus = (params.status as AuthFilterStatus) ?? "todos";
  if (!params.status && params.etapa) {
    if (params.etapa === "docs") initialStatus = "falta_docs";
    else if (params.etapa === "autorizacao") initialStatus = "aguardando";
    else if (params.etapa === "agendar") initialStatus = "concluidas";
  }

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Autorizações"
        description="Painel inteligente de autorizações e leads do WhatsApp com filtros por status, separação de não atendidos e quadros coloridos."
      />
      <PageContainer className="gap-5">
        {queue.length === 0 ? (
          <div className="my-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center shadow-2xs">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-xs">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="m-0 text-xl font-bold text-slate-800">Nenhuma autorização pendente</h2>
            <p className="m-0 mt-2 max-w-md text-sm text-slate-600">
              Todos os contatos do WhatsApp foram processados ou já possuem guia autorizada. Novos leads com documentos aparecerão automaticamente aqui.
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
            owners={(reassignCandidates ?? []).map((c) => ({ id: c.id, name: c.full_name }))}
            initial={{
              q: params.q ?? "",
              status: initialStatus,
              pendencia: (params.pendencia as AuthFilterPendency) ?? "todas",
              encaminhamento: (params.encaminhamento as AuthFilterForwarding) ?? (params.dono ? params.dono : params.meus === "1" ? "meus" : "todos"),
              item: requestedItem,
            }}
          />
        )}
      </PageContainer>
    </main>
  );
}
