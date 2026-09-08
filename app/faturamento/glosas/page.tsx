import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { FaturamentoHeader } from "../faturamento-header";
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function GlosasPage() {
  const supabase = await createClient();

  let items: any[] = [];
  try {
    const { data } = await (supabase as any)
      .from("billing_disallowances")
      .select(`
        *,
        insurers(name),
        patients(full_name)
      `)
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("created_at", { ascending: false });
    if (data) items = data;
  } catch (e) {
    items = [];
  }

  // Mocks estatísticos caso tabela esteja vazia inicialmente
  const totalGlosa = items.reduce((acc, item) => acc + Number(item.amount), 0) || 14250.00;
  const countPendente = items.filter(i => i.status === 'identificada' || i.status === 'em_analise').length || 8;
  const countDeferida = items.filter(i => i.status === 'deferida').length || 12;

  const mockCards = [
    {
      id: "1",
      code: "1009",
      reason: "Ausência de autorização prévia da operadora para sessão de Psicologia",
      insurer: "UNIMED",
      patient: "Enzo Gabriel Santos",
      amount: 240.00,
      status: "identificada",
      deadline: "2026-09-20"
    },
    {
      id: "2",
      code: "1802",
      reason: "Evolução clínica sem assinatura digital de auditoria",
      insurer: "BRADESCO SAÚDE",
      patient: "Sophia Oliveira",
      amount: 380.00,
      status: "em_analise",
      deadline: "2026-09-15"
    },
    {
      id: "3",
      code: "2204",
      reason: "Guia vencida na data do atendimento",
      insurer: "AMIL",
      patient: "Lucas Mendes",
      amount: 190.00,
      status: "deferida",
      deadline: "2026-09-01"
    }
  ];

  const displayList = items.length > 0 ? items : mockCards;

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <FaturamentoHeader active="glosas" />

      <div className="flex flex-col gap-8 px-10 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Faturamento & Conciliação
            </h6>
            <h1 className="m-0">Gestão de Glosas e Recursos TISS</h1>
          </div>
          <button className="btn btn-primary flex items-center gap-2">
            <FileText size={16} /> Importar Retorno XML/TISS
          </button>
        </div>

        {/* Métricas de Topo */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <AlertCircle size={18} className="text-amber-500" /> Glosa Total em Aberto
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--status-falta)" }}>
              {formatCurrency(totalGlosa)}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Valores notificados e aguardando contestação</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <Clock size={18} className="text-blue-500" /> Recursos em Tramitação
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {countPendente} guias
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Dentro do prazo legal de contestação</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <CheckCircle2 size={18} className="text-emerald-500" /> Taxa de Recuperação (Deferidas)
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--status-realizada)" }}>
              84.5%
            </div>
            <span className="text-xs text-ink-faint mt-1 block">{countDeferida} recursos aceitos nos últimos 60 dias</span>
          </div>
        </section>

        {/* Tabela de Glosas */}
        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Glosas Pendentes e em Contestação</h3>

          <table className="table w-full">
            <thead>
              <tr>
                <th>Cód. Glosa</th>
                <th>Operadora</th>
                <th>Paciente</th>
                <th>Motivo / Apontamento</th>
                <th>Valor</th>
                <th>Prazo Limite</th>
                <th>Status</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((item: any) => (
                <tr key={item.id}>
                  <td className="font-mono font-bold text-xs">{item.code || item.disallowance_code}</td>
                  <td className="font-semibold">{item.insurer || item.insurers?.name}</td>
                  <td>{item.patient || item.patients?.full_name}</td>
                  <td className="max-w-xs truncate text-xs text-ink-soft" title={item.reason}>{item.reason}</td>
                  <td className="tabular-figure font-semibold">{formatCurrency(item.amount)}</td>
                  <td className="tabular-figure text-xs text-ink-faint">{item.deadline || item.appeal_deadline || '15/09/2026'}</td>
                  <td>
                    <span className={`tag-status ${item.status === 'deferida' ? 'st-realizada' : item.status === 'em_analise' ? 'st-agendada' : 'st-falta'}`}>
                      {item.status === 'deferida' ? 'Deferido' : item.status === 'em_analise' ? 'Em Recursos' : 'Identificada'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost text-xs flex items-center gap-1">
                      Contestar <ArrowUpRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
