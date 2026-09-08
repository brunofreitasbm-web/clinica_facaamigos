import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { GestorNav } from "@/components/gestor-nav";
import { FinanceiroSubnav } from "@/components/financeiro-subnav";
import { Receipt, AlertTriangle, Clock } from "lucide-react";
import { NewExpenseDialog } from "./new-expense-dialog";
import { ExpenseRowActions } from "./expense-row-actions";

export const dynamic = "force-dynamic";

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CATEGORY_LABEL: Record<string, string> = {
  aluguel: "Aluguel",
  folha: "Folha de Pagamento",
  fornecedores: "Fornecedores",
  impostos: "Impostos",
  marketing: "Marketing",
  manutencao: "Manutenção",
  outros: "Outros",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pago: "Paga",
  atrasado: "Atrasada",
  cancelado: "Cancelada",
};

const STATUS_TAG: Record<string, string> = {
  pendente: "st-agendada",
  pago: "st-realizada",
  atrasado: "st-falta",
  cancelado: "st-cancelada",
};

export default async function ContasAPagarPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("accounts_payable")
    .select("id, category, description, amount, due_date, status, recurring, notes")
    .eq("clinic_id", DEV_CLINIC_ID)
    .order("due_date", { ascending: true });

  const expenses = (rows ?? []).map((e) => {
    const isOverdue = e.status === "pendente" && e.due_date < new Date().toISOString().slice(0, 10);
    return { ...e, effectiveStatus: isOverdue ? "atrasado" : e.status };
  });

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

  const pendingThisMonth = expenses.filter(
    (e) => e.due_date >= monthStart && e.due_date < nextMonthStart && (e.effectiveStatus === "pendente" || e.effectiveStatus === "atrasado")
  );
  const overdue = expenses.filter((e) => e.effectiveStatus === "atrasado");
  const pendingTotal = pendingThisMonth.reduce((sum, e) => sum + Number(e.amount), 0);
  const overdueTotal = overdue.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <main className="flex flex-1 flex-col pb-16" style={{ background: "var(--color-bg)" }}>
      <GestorNav active="financeiro" />
      <FinanceiroSubnav activeTab="contas-a-pagar" />

      <div className="flex flex-col gap-8 px-10 pt-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1">
              Financeiro
            </h6>
            <h1 className="m-0">Contas a Pagar</h1>
          </div>
          <NewExpenseDialog />
        </div>

        <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <Clock size={18} className="text-amber-500" /> Pendentes no Mês
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {formatCurrency(pendingTotal)}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">
              {pendingThisMonth.length} conta{pendingThisMonth.length === 1 ? "" : "s"} com vencimento este mês
            </span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <AlertTriangle size={18} className="text-red-500" /> Atrasadas
            </div>
            <div
              className="tabular-figure text-3xl font-bold"
              style={{ fontFamily: "var(--font-heading)", color: overdue.length > 0 ? "var(--status-falta)" : "var(--status-realizada)" }}
            >
              {formatCurrency(overdueTotal)}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">{overdue.length} conta{overdue.length === 1 ? "" : "s"} vencida{overdue.length === 1 ? "" : "s"}</span>
          </div>

          <div className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-faint mb-2">
              <Receipt size={18} className="text-blue-600" /> Total Cadastrado
            </div>
            <div className="tabular-figure text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {expenses.length} conta{expenses.length === 1 ? "" : "s"}
            </div>
            <span className="text-xs text-ink-faint mt-1 block">Todas as competências</span>
          </div>
        </section>

        <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
          <h3 className="mb-4">Lista de Despesas</h3>

          {expenses.length === 0 ? (
            <p className="text-sm text-ink-faint">Nenhuma despesa cadastrada ainda.</p>
          ) : (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="font-semibold">{e.description}</div>
                      {e.recurring && <div className="text-[11px] text-ink-faint">Recorrente</div>}
                    </td>
                    <td className="text-xs">{CATEGORY_LABEL[e.category] ?? e.category}</td>
                    <td className="tabular-figure font-bold text-sm">{formatCurrency(Number(e.amount))}</td>
                    <td className="tabular-figure text-xs text-ink-faint">{e.due_date}</td>
                    <td>
                      <span className={`tag-status ${STATUS_TAG[e.effectiveStatus] ?? "st-agendada"}`}>{STATUS_LABEL[e.effectiveStatus] ?? e.effectiveStatus}</span>
                    </td>
                    <td>{(e.effectiveStatus === "pendente" || e.effectiveStatus === "atrasado") && <ExpenseRowActions expenseId={e.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
