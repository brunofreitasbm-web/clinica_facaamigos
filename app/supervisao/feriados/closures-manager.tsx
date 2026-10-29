"use client";

import { useState, useTransition } from "react";
import { addClosure, removeClosure } from "./actions";

export type ClosureRow = {
  id: string;
  closure_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  kind: string;
};
export type NationalHoliday = { date: string; name: string };

const KIND_LABEL: Record<string, string> = {
  feriado_municipal: "Feriado municipal",
  feriado_estadual: "Feriado estadual",
  recesso: "Recesso",
  fechamento: "Fechamento",
};

function brDate(iso: string) {
  return `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

const inputClass = "mt-1 w-full rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm text-ink";

export function ClosuresManager({ holidays, closures }: { holidays: NationalHoliday[]; closures: ClosureRow[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "warn"; text: string } | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await addClosure(formData);
      if (!res.success) return setMessage({ tone: "error", text: res.error });
      const c = res.collisions;
      if (c && c.count > 0) {
        setMessage({
          tone: "warn",
          text: `Fechamento salvo. ${c.count} agendamento(s) já marcado(s) caem nesse período e NÃO foram alterados — remarque com as famílias. Ex.: ${c.sample.join("; ")}.`,
        });
      } else {
        setMessage({ tone: "ok", text: "Fechamento salvo. Nenhum agendamento marcado nesse período." });
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await removeClosure(id);
      setMessage(res.success ? { tone: "ok", text: "Fechamento removido." } : { tone: "error", text: res.error });
    });
  }

  const toneClass =
    message?.tone === "error"
      ? "border-status-negative text-status-negative-text"
      : message?.tone === "warn"
        ? "border-amber-400 text-ink"
        : "border-paper-line-strong text-ink-soft";

  return (
    <div className="flex flex-col gap-6">
      <form action={submit} className="grid gap-3 rounded-lg border border-paper-line-strong bg-white p-5 shadow-sm sm:grid-cols-6">
        <label className="text-xs font-semibold text-ink-soft sm:col-span-1">
          Data
          <input type="date" name="closure_date" required className={inputClass} />
        </label>
        <label className="text-xs font-semibold text-ink-soft sm:col-span-1">
          Tipo
          <select name="kind" defaultValue="feriado_municipal" className={inputClass}>
            {Object.entries(KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-ink-soft sm:col-span-2">
          Motivo
          <input name="reason" required maxLength={120} placeholder="Ex.: Aniversário da cidade" className={inputClass} />
        </label>
        <label className="text-xs font-semibold text-ink-soft sm:col-span-1">
          Das (opcional)
          <input type="time" name="start_time" className={inputClass} />
        </label>
        <label className="text-xs font-semibold text-ink-soft sm:col-span-1">
          Até (opcional)
          <input type="time" name="end_time" className={inputClass} />
        </label>
        <div className="flex items-center justify-between gap-3 sm:col-span-6">
          <p className="text-xs text-ink-faint">Sem horário = clínica fechada o dia inteiro.</p>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-chart px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Cadastrar fechamento"}
          </button>
        </div>
      </form>

      {message && <p className={`rounded-md border bg-white px-3 py-2 text-xs font-semibold ${toneClass}`}>{message.text}</p>}

      <section className="rounded-lg border border-paper-line-strong bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-ink">Fechamentos cadastrados</h2>
        {closures.length === 0 ? (
          <p className="mt-2 text-xs text-ink-faint">Nenhum. Feriados nacionais já são bloqueados automaticamente.</p>
        ) : (
          <ul className="mt-3 divide-y divide-paper-line">
            {closures.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <strong className="tabular-nums">{brDate(c.closure_date)}</strong>{" "}
                  {c.start_time && c.end_time ? `${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}` : "dia inteiro"} · {c.reason}{" "}
                  <span className="text-xs text-ink-faint">({KIND_LABEL[c.kind] ?? c.kind})</span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(c.id)}
                  className="rounded-md border border-paper-line-strong px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-status-negative hover:text-status-negative-text disabled:opacity-50"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-paper-line-strong bg-paper/60 p-5">
        <h2 className="text-sm font-bold text-ink">Feriados nacionais (automáticos)</h2>
        <p className="mt-1 text-xs text-ink-faint">Calculados pelo sistema, inclusive Carnaval e Corpus Christi. Não precisam de cadastro.</p>
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {holidays.map((h) => (
            <li key={h.date} className="flex gap-2">
              <span className="w-24 shrink-0 font-semibold tabular-nums">{brDate(h.date)}</span>
              <span className="text-ink-soft">{h.name}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
