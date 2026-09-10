"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Check } from "lucide-react";
import { USUAL_PAYABLES, suggestedDueDate, type UsualPayable } from "@/lib/usual-payables";
import { createUsualExpense } from "./actions";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const CATEGORY_LABEL: Record<string, string> = {
  aluguel: "Aluguel",
  folha: "Folha de Pagamento",
  fornecedores: "Fornecedores",
  impostos: "Impostos",
  marketing: "Marketing",
  manutencao: "Manutenção",
  outros: "Outros",
};

export type MonthExpense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  status: string;
};

/** "1.234,56" ou "1234.56" digitado à mão vira número. */
function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function ContasAPagarPanel({
  competenceMonth,
  expenses,
  monthLabel,
}: {
  competenceMonth: string;
  expenses: MonthExpense[];
  monthLabel: string;
}) {
  const [showCatalog, setShowCatalog] = useState(false);

  const alreadyLaunched = useMemo(() => {
    // O lançamento rápido grava "<rótulo do catálogo> — <mês por extenso>";
    // é por esse prefixo que a conta já lançada é reconhecida no mês.
    const set = new Set<string>();
    for (const expense of expenses) {
      const item = USUAL_PAYABLES.find((entry) => expense.description.startsWith(entry.label));
      if (item) set.add(item.key);
    }
    return set;
  }, [expenses]);

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="mb-1">Contas a Pagar — <span className="capitalize">{monthLabel}</span></h3>
          <p className="text-xs text-ink-faint max-w-2xl">
            As despesas com vencimento no mês, que entram na DRE acima. Use &quot;Preencher contas usuais&quot; para abrir o catálogo de
            despesas recorrentes de clínica: digite o valor e dê Enter para lançar cada uma. Nenhum valor vem preenchido — só o
            rótulo, a categoria e o vencimento sugerido.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-right">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Total do mês</span>
            <span className="tabular-figure text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {currency.format(total)}
            </span>
          </span>
          <button type="button" className="btn btn-primary flex items-center gap-2" onClick={() => setShowCatalog((value) => !value)}>
            <ListPlus size={16} /> {showCatalog ? "Fechar catálogo" : "Preencher contas usuais"}
          </button>
        </div>
      </div>

      {showCatalog && (
        <div className="mt-5 rounded-lg border p-4" style={{ borderColor: "var(--color-neutral-200)", background: "var(--color-bg)" }}>
          <p className="mb-3 text-[11px] text-ink-faint">
            Valor + Enter lança a despesa em <span className="capitalize">{monthLabel}</span>. Deixe em branco o que a clínica não paga.
          </p>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {USUAL_PAYABLES.map((item) => (
              <UsualPayableRow
                key={item.key}
                item={item}
                competenceMonth={competenceMonth}
                alreadyLaunched={alreadyLaunched.has(item.key)}
              />
            ))}
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <p className="mt-6 text-sm text-ink-faint">Nenhuma despesa com vencimento neste mês.</p>
      ) : (
        <table className="table mt-6 w-full">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="font-semibold text-xs">{expense.description}</td>
                <td className="text-xs">{CATEGORY_LABEL[expense.category] ?? expense.category}</td>
                <td className="tabular-figure text-xs text-ink-faint">{expense.dueDate}</td>
                <td className="text-xs capitalize">{expense.status}</td>
                <td className="tabular-figure text-sm font-bold">{currency.format(expense.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function UsualPayableRow({
  item,
  competenceMonth,
  alreadyLaunched,
}: {
  item: UsualPayable;
  competenceMonth: string;
  alreadyLaunched: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dueDate = suggestedDueDate(competenceMonth, item.dueDay);
  const done = saved || alreadyLaunched;

  function submit() {
    const amount = parseAmount(value);
    if (amount === null) {
      setError("Valor inválido");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createUsualExpense({ key: item.key, amount, competenceMonth, dueDate });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setValue("");
      router.refresh();
    });
  }

  return (
    <div
      className="flex items-center gap-3 rounded-md border px-3 py-2"
      style={{ borderColor: "var(--color-neutral-200)", background: done ? "var(--color-bg)" : "#fff" }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{item.label}</span>
        <span className="block text-[10px] text-ink-faint">
          {CATEGORY_LABEL[item.category]} · vence {dueDate}
          {item.recurring ? " · recorrente" : ""}
        </span>
      </span>

      {done && (
        <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--status-realizada)" }}>
          <Check size={14} /> lançada
        </span>
      )}

      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder="R$ 0,00"
        disabled={isPending}
        aria-label={`Valor de ${item.label}`}
        onChange={(event) => {
          setValue(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        className="input w-28 text-right text-xs tabular-figure"
        style={error ? { borderColor: "var(--status-falta)" } : undefined}
      />
      {error && (
        <span className="text-[10px]" style={{ color: "var(--status-falta)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
