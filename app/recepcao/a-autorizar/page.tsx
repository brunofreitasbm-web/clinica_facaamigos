import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getReceptionQueue, isAuthorizationQueueItem } from "@/lib/reception-queue";
import { QueueWorkspace, type QueueStage } from "../pacientes/pendencias/queue-workspace";
import { buildWorkspaceItems } from "../pacientes/pendencias/queue-items";
import { ShieldCheck, FileClock, CheckCircle, AlertTriangle, ArrowRight, CalendarDays, Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

const QUEUE_STAGES: QueueStage[] = ["docs", "autorizacao", "agendar"];

/**
 * "Autorizações": lead do WhatsApp com documentos completos que ainda não passou pelo
 * plano de saúde — documentos e dados captados pelo bot, mais a linha do tempo da
 * autorização (guia enviada → plano autorizou → habilitar agendamento). É o
 * mesmo painel de contato da Fila de pendências (DraftIntakeCard), só que
 * recortado para essa etapa. Quem a Supervisão devolveu volta aqui com o motivo.
 */
export default async function AAutorizarPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; q?: string; etapa?: string; dono?: string; meus?: string }>;
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
  const etapa = QUEUE_STAGES.includes(params.etapa as QueueStage) ? (params.etapa as QueueStage) : null;
  const requestedItem = params.item && queue.some((item) => item.id === params.item) ? params.item : null;

  // Métricas do Funil (Leis de Miller e Hick para chunking cognitivo)
  const totalCount = items.length;
  const docsCount = items.filter((i) => i.stage === "docs").length;
  const autorizacaoCount = items.filter((i) => i.stage === "autorizacao").length;
  const agendarCount = items.filter((i) => i.stage === "agendar").length;
  const urgentCount = items.filter((i) => i.overdue || i.escalated || i.band === "agora").length;

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader
        axisLabel="Recepção"
        title="Autorizações"
        description="Leads do WhatsApp (ainda sem prontuário) com documentos e dados captados, a caminho da autorização do plano de saúde."
      />
      <PageContainer className="gap-5">
        {/* Funil Visual de Autorizações (Lei de Fitts e Miller) */}
        {totalCount > 0 && (
          <nav aria-label="Funil de autorizações" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <Link
              href="/recepcao/a-autorizar"
              className={`flex flex-col gap-1 rounded-xl border p-3.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                !etapa
                  ? "border-teal-600 bg-teal-50/70 shadow-xs"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total</span>
                <Inbox className="h-4 w-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900">{totalCount}</span>
                <span className="text-[11px] text-slate-500">no funil</span>
              </div>
            </Link>

            <Link
              href="/recepcao/a-autorizar?etapa=docs"
              className={`flex flex-col gap-1 rounded-xl border p-3.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                etapa === "docs"
                  ? "border-sky-600 bg-sky-50/70 shadow-xs"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">Faltam Docs</span>
                <FileClock className="h-4 w-4 text-sky-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-sky-950">{docsCount}</span>
                <span className="text-[11px] text-sky-700">pendente guia/doc</span>
              </div>
            </Link>

            <Link
              href="/recepcao/a-autorizar?etapa=autorizacao"
              className={`flex flex-col gap-1 rounded-xl border p-3.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                etapa === "autorizacao"
                  ? "border-amber-600 bg-amber-50/70 shadow-xs"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">No Plano</span>
                <ShieldCheck className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-amber-950">{autorizacaoCount}</span>
                <span className="text-[11px] text-amber-700">aguardando retorno</span>
              </div>
            </Link>

            <Link
              href="/recepcao/a-autorizar?etapa=agendar"
              className={`flex flex-col gap-1 rounded-xl border p-3.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                etapa === "agendar"
                  ? "border-emerald-600 bg-emerald-50/70 shadow-xs"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Pronto</span>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-emerald-950">{agendarCount}</span>
                <span className="text-[11px] text-emerald-700">p/ agendar</span>
              </div>
            </Link>

            {urgentCount > 0 && (
              <div className="flex flex-col gap-1 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Urgentes</span>
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-rose-950">{urgentCount}</span>
                  <span className="text-[11px] text-rose-700">atenção imediata</span>
                </div>
              </div>
            )}
          </nav>
        )}

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
          <QueueWorkspace
            items={items}
            split
            categoryOrder={["cadastro_assistido_ia"]}
            owners={(reassignCandidates ?? []).map((c) => ({ id: c.id, name: c.full_name }))}
            initial={{ q: params.q ?? "", tipo: null, etapa, dono: params.dono ?? null, meus: params.meus === "1", item: requestedItem }}
          />
        )}
      </PageContainer>
    </main>
  );
}
