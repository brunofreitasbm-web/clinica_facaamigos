"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importGlosasCsv } from "./actions";

type Skipped = { line: number; guide: string; reason: string };

export function CsvImportForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ processed: number; skipped: Skipped[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-md border border-paper-line-strong px-4 py-2 text-sm text-chart hover:border-chart"
      >
        Importar CSV de retorno do convênio
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper/60 p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-ink-soft">Importar CSV</h2>
      <p className="text-xs text-ink-faint">
        Arquivo separado por ponto e vírgula com colunas <code>Guia;Valor;Motivo</code>. Cada glosa importada é
        atribuída a &quot;Operadora&quot; — linhas cuja guia não achar exatamente um item enviado ficam de fora
        pra tratamento manual.
      </p>
      <form
        ref={formRef}
        className="flex flex-wrap items-center gap-3"
        action={(formData) => {
          setError(null);
          setResult(null);
          startTransition(async () => {
            const res = await importGlosasCsv(formData);
            if (!res.success) {
              setError(res.error);
              return;
            }
            setResult({ processed: res.processed, skipped: res.skipped });
            formRef.current?.reset();
            router.refresh();
          });
        }}
      >
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="rounded-md border border-paper-line-strong bg-paper px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-chart px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          {isPending ? "Importando…" : "Importar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setResult(null);
            setError(null);
          }}
          className="rounded-md border border-paper-line-strong px-4 py-2 text-sm text-ink"
        >
          Fechar
        </button>
      </form>
      {error && <p className="text-xs text-status-negative-text">{error}</p>}
      {result && (
        <div className="text-xs text-ink-soft">
          <p>
            {result.processed} glosa(s) registrada(s) com sucesso.{" "}
            {result.skipped.length > 0 && `${result.skipped.length} linha(s) não processada(s):`}
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1">
              {result.skipped.map((s, idx) => (
                <li key={idx} className="text-status-negative-text">
                  Linha {s.line} (guia {s.guide || "—"}): {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
