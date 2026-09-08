import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { GestorNav } from "@/components/gestor-nav";
import { FinanceiroSubnav } from "@/components/financeiro-subnav";
import { FileText, Clock, CreditCard } from "lucide-react";
import { NewContractDialog } from "./new-contract-dialog";
import { GenerateInvoiceButton, MarkInvoicePaidButton } from "./invoice-actions";

export const dynamic = "force-dynamic";

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PLAN_LABEL: Record<string, string> = {
  particular: "Particular Puro",
  reembolso_assistido: "Reembolso Assistido",
  coparticipacao: "Co-participação",
};

const INVOICE_STATUS_TAG: Record<string, string> = {
  pendente: "st-agendada",
  pago: "st-realizada",
  atrasado: "st-falta",
  cancelado: "st-cancelada",
};

export default async function ContratosPage() {
  const supabase = await createClient();

  const { data: contractRows } = await supabase
    .from("patient_contracts")
    .select("id, plan_type, monthly_fee, payment_day, status, start_date, patient_id, patients(full_name, cpf)")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("created_at", { ascending: false });

  const contracts = contractRows ?? [];
  const contractIds = contracts.map((c) => c.id);

  type InvoiceRow = {
    id: string;
    contract_id: string;
    due_date: string;
    amount: number;
    status: string;
    paid_at: string | null;
  };

  const { data: invoiceRowsRaw } = contractIds.length
    ? await supabase
        .from("contract_invoices")
        .select("id, contract_id, due_date, amount, status, paid_at")
        .in("contract_id", contractIds)
        .order("due_date", { ascending: false })
    : { data: [] as InvoiceRow[] };

  const invoiceRows = invoiceRowsRaw ?? [];

  const invoicesByContract = new Map<string, InvoiceRow[]>();
  for (const inv of invoiceRows) {
    const list = invoicesByContract.get(inv.contract_id) ?? [];
    list.push(inv);
    invoicesByContract.set(inv.contract_id, list);
  }

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

  const activeContracts = contracts.filter((c) => c.status === "ativo");
  const totalMonthlyFee = activeContracts.reduce((sum, c) => sum + Number(c.monthly_fee), 0);

  const pendingInvoicesThisMonth = invoiceRows.filter(
    (inv) => inv.due_date >= monthStart && inv.due_date < nextMonthStart && (inv.status === "pendente" || inv.status === "atrasado")
  );
  const pendingTotal = pendingInvoicesThisMonth.reduce((sum, inv) => sum + Number(inv.amount), 0);

  const { data: allPatients } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("full_name", { ascending: true });

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <GestorNav active="financeiro" />
      <FinanceiroSubnav activeTab="contratos" />

      <div className="flex flex-col gap-8 px-10 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Faturamento Particular
            </h6>
            <h1 className="m-0">Gestão de Contratos e Cobrança Particular</h1>
          </div>
          <NewContractDialog patients={allPatients ?? []} />
        </div>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <FileText size={18} className="text-blue-600" /> Contratos Particulares Ativos
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {activeContracts.length} contrato{activeContracts.length === 1 ? "" : "s"}
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
            <span className="text-xs text-ink-faint mt-1 block">Soma das mensalidades de contratos ativos</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <Clock size={18} className="text-amber-500" /> Cobranças Pendentes no Mês
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent-2-600)" }}>
              {pendingInvoicesThisMonth.length} fatura{pendingInvoicesThisMonth.length === 1 ? "" : "s"} ({formatCurrency(pendingTotal)})
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Faturas do mês corrente ainda em aberto</span>
          </div>
        </section>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Lista de Contratos</h3>

          {contracts.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhum contrato particular cadastrado ainda.</p>
          ) : (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Modalidade</th>
                  <th>Mensalidade</th>
                  <th>Vencimento</th>
                  <th>Início</th>
                  <th>Status</th>
                  <th>Faturas do Mês</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const invoices = (invoicesByContract.get(c.id) ?? []).filter(
                    (inv) => inv.due_date >= monthStart && inv.due_date < nextMonthStart
                  );
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="font-semibold">{(c.patients as any)?.full_name ?? "—"}</div>
                        <div className="text-xs text-ink-faint">CPF: {(c.patients as any)?.cpf || "não informado"}</div>
                      </td>
                      <td className="text-xs font-medium">{PLAN_LABEL[c.plan_type] ?? c.plan_type}</td>
                      <td className="tabular-figure font-bold text-sm">{formatCurrency(Number(c.monthly_fee))}</td>
                      <td className="tabular-figure text-xs">Todo dia {c.payment_day}</td>
                      <td className="tabular-figure text-xs text-ink-faint">{c.start_date}</td>
                      <td>
                        <span className={`tag-status ${c.status === "ativo" ? "st-realizada" : "st-cancelada"}`}>
                          {c.status === "ativo" ? "Ativo" : c.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {invoices.length === 0 && c.status === "ativo" && <GenerateInvoiceButton contractId={c.id} />}
                          {invoices.map((inv) => (
                            <div key={inv.id} className="flex items-center gap-2">
                              <span className={`tag-status ${INVOICE_STATUS_TAG[inv.status] ?? "st-agendada"}`}>
                                {inv.status === "pago" ? "Paga" : inv.status === "atrasado" ? "Atrasada" : inv.status === "pendente" ? "Pendente" : "Cancelada"}
                              </span>
                              <span className="text-xs">{formatCurrency(Number(inv.amount))}</span>
                              {inv.status !== "pago" && <MarkInvoicePaidButton invoiceId={inv.id} />}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
