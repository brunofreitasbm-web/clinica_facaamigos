import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { GestorNav } from "@/components/gestor-nav";
import { FileText, Plus, CheckCircle, Clock, CreditCard, Send, Download } from "lucide-react";

export const dynamic = "force-dynamic";

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ContratosPage() {
  const supabase = await createClient();

  let contractsList: any[] = [];
  try {
    const { data } = await (supabase as any)
      .from("patient_contracts")
      .select(`
        *,
        patients(full_name, cpf)
      `)
      .eq("clinic_id", DEV_CLINIC_ID)
      .order("created_at", { ascending: false });
    if (data) contractsList = data;
  } catch (e) {
    contractsList = [];
  }

  // Mocks caso a tabela ainda não tenha sido populada
  const mockContracts = [
    {
      id: "1",
      patient: "Matheus Henrique Silva",
      cpf: "123.456.789-00",
      plan_type: "particular",
      monthly_fee: 3800.00,
      payment_day: 5,
      status: "ativo",
      start_date: "2026-01-10"
    },
    {
      id: "2",
      patient: "Isabella Rocha",
      cpf: "987.654.321-11",
      plan_type: "reembolso_assistido",
      monthly_fee: 4500.00,
      payment_day: 10,
      status: "ativo",
      start_date: "2026-02-01"
    },
    {
      id: "3",
      patient: "Bernardo Costa",
      cpf: "456.789.123-22",
      plan_type: "coparticipacao",
      monthly_fee: 850.00,
      payment_day: 15,
      status: "ativo",
      start_date: "2026-03-15"
    }
  ];

  const displayContracts = contractsList.length > 0 ? contractsList : mockContracts;

  const totalMonthlyFee = displayContracts.reduce((sum, c) => sum + Number(c.monthly_fee), 0);

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <GestorNav active="financeiro" />

      <div className="flex flex-col gap-8 px-10 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Faturamento Particular & Convênio
            </h6>
            <h1 className="m-0">Gestão de Contratos e Cobrança Particular</h1>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary flex items-center gap-2">
              <Download size={16} /> Emitir Declaração Anual IR
            </button>
            <button className="btn btn-primary flex items-center gap-2">
              <Plus size={16} /> Novo Contrato de Paciente
            </button>
          </div>
        </div>

        {/* Resumo Financeiro de Contratos */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <FileText size={18} className="text-blue-600" /> Contratos Particulares Ativos
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {displayContracts.length} contratos
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Pacientes no modelo particular/reembolso</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <CreditCard size={18} className="text-emerald-500" /> Receita Mensal Recorrente (MRR)
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--status-realizada)" }}>
              {formatCurrency(totalMonthlyFee)}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Faturamento mensal em contratos particulares</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <Clock size={18} className="text-amber-500" /> Cobranças Pendentes no Mês
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent-2-600)" }}>
              2 faturas (R$ 5.350,00)
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Envio automático de lembrete de PIX ativado</span>
          </div>
        </section>

        {/* Tabela de Contratos */}
        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Lista de Contratos Vigentes</h3>

          <table className="table w-full">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Modalidade</th>
                <th>Mensalidade</th>
                <th>Dia de Vencimento</th>
                <th>Início do Contrato</th>
                <th>Status</th>
                <th>Ações de Cobrança</th>
              </tr>
            </thead>
            <tbody>
              {displayContracts.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <div className="font-semibold">{c.patient || c.patients?.full_name}</div>
                    <div className="text-xs text-ink-faint">CPF: {c.cpf || c.patients?.cpf || '123.456.789-00'}</div>
                  </td>
                  <td className="capitalize text-xs font-medium">
                    {c.plan_type === 'reembolso_assistido' ? 'Reembolso Assistido' : c.plan_type === 'coparticipacao' ? 'Co-participação' : 'Particular Puro'}
                  </td>
                  <td className="tabular-figure font-bold text-sm">{formatCurrency(c.monthly_fee)}</td>
                  <td className="tabular-figure text-xs">Todo dia {c.payment_day}</td>
                  <td className="tabular-figure text-xs text-ink-faint">{c.start_date}</td>
                  <td>
                    <span className="tag-status st-realizada">Ativo</span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost text-xs flex items-center gap-1">
                        <Send size={12} /> Enviar PIX
                      </button>
                      <button className="btn btn-ghost text-xs flex items-center gap-1">
                        <FileText size={12} /> Recibo
                      </button>
                    </div>
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
