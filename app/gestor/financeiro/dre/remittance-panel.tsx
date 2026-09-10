"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, AlertTriangle, FileText } from "lucide-react";
import type { RemittanceBatchRow } from "./remittance-data";
import { uploadRemittanceNote, setLineConsolidated, setBatchConsolidated, deleteRemittanceBatch } from "./actions";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

type Feedback = { kind: "success" | "error" | "warning"; text: string } | null;

export function RemittancePanel({
  batches,
  insurers,
  defaultCompetence,
}: {
  batches: RemittanceBatchRow[];
  insurers: { id: string; name: string }[];
  defaultCompetence: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isUploading, startUpload] = useTransition();
  const [openBatchId, setOpenBatchId] = useState<string | null>(batches[0]?.id ?? null);

  function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback(null);
    startUpload(async () => {
      const result = await uploadRemittanceNote(formData);
      if (!result.success) {
        setFeedback({ kind: "error", text: result.error });
        return;
      }
      formRef.current?.reset();
      setFeedback({
        kind: result.warnings.length > 0 ? "warning" : "success",
        text:
          `${result.lineCount} linha(s) lida(s) · ${currency.format(result.totalNet)} de recebível.` +
          (result.warnings.length > 0 ? ` ${result.warnings.join(" ")}` : ""),
      });
      setOpenBatchId(result.batchId);
      router.refresh();
    });
  }

  const totalConsolidated = batches.reduce((sum, batch) => sum + batch.consolidatedNet, 0);

  return (
    <section className="rounded-xl border p-6 shadow-sm" style={{ background: "#fff", borderColor: "var(--color-neutral-200)" }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="mb-1">Notas dos Planos de Saúde</h3>
          <p className="text-xs text-ink-faint max-w-2xl">
            Envie o demonstrativo de pagamento do convênio (PDF, CSV ou XLSX). As colunas são reconhecidas pela posição de cada valor
            na tabela — não pelo texto corrido — e só as linhas ficam gravadas, não o arquivo. Marque no checkbox as linhas que são
            recebíveis para consolidá-las na DRE.
          </p>
        </div>
        <div className="text-right">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Consolidado na DRE</span>
          <span className="tabular-figure text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            {currency.format(totalConsolidated)}
          </span>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleUpload} className="mt-5 grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-4" style={{ borderColor: "var(--color-neutral-200)", background: "var(--color-bg)" }}>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint sm:col-span-2">
          Arquivo da nota
          <input
            type="file"
            name="file"
            required
            accept=".pdf,.csv,.txt,.xlsx,.xlsm"
            className="input text-xs"
            disabled={isUploading}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Convênio
          <select name="insurerId" className="input" defaultValue="" disabled={isUploading}>
            <option value="">Detectar pelo arquivo</option>
            {insurers.map((insurer) => (
              <option key={insurer.id} value={insurer.id}>
                {insurer.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-faint">
          Competência
          <input type="month" name="competenceMonth" className="input" defaultValue={defaultCompetence} disabled={isUploading} />
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-ink-faint sm:col-span-3">
          <input type="checkbox" name="consolidateAll" defaultChecked disabled={isUploading} />
          Já consolidar todas as linhas lidas como recebível na DRE (linhas sem tabela reconhecida ficam de fora)
        </label>

        <div className="flex items-end justify-end sm:col-span-1">
          <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={isUploading}>
            <Upload size={16} /> {isUploading ? "Lendo…" : "Enviar e ler"}
          </button>
        </div>

        {feedback && (
          <p
            className="text-xs sm:col-span-4"
            style={{
              color:
                feedback.kind === "error"
                  ? "var(--status-falta)"
                  : feedback.kind === "warning"
                    ? "var(--color-accent-2-600)"
                    : "var(--status-realizada)",
            }}
          >
            {feedback.text}
          </p>
        )}
      </form>

      {batches.length === 0 ? (
        <p className="mt-6 text-sm text-ink-faint">Nenhuma nota enviada ainda.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {batches.map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              open={openBatchId === batch.id}
              onToggleOpen={() => setOpenBatchId(openBatchId === batch.id ? null : batch.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BatchCard({ batch, open, onToggleOpen }: { batch: RemittanceBatchRow; open: boolean; onToggleOpen: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ success: true } | { success: false; error: string } | { success: true; updated: number }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const allConsolidated = batch.lines.length > 0 && batch.lines.every((line) => line.consolidated);

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--color-neutral-200)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <button type="button" onClick={onToggleOpen} className="flex items-center gap-3 text-left">
          <FileText size={18} className="text-ink-faint" />
          <span>
            <span className="block text-sm font-semibold">{batch.insurerName ?? "Convênio não identificado"}</span>
            <span className="block text-[11px] text-ink-faint">
              {batch.fileName} · competência <span className="capitalize">{monthLabel(batch.competenceMonth)}</span> · {batch.lines.length} linha(s)
            </span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <span className="text-right">
            <span className="block text-[11px] text-ink-faint">Nota</span>
            <span className="tabular-figure text-sm font-semibold">{currency.format(batch.totalNet)}</span>
          </span>
          <span className="text-right">
            <span className="block text-[11px] text-ink-faint">Glosa</span>
            <span className="tabular-figure text-sm" style={{ color: "var(--status-falta)" }}>
              {currency.format(batch.totalGlosa)}
            </span>
          </span>
          <span className="text-right">
            <span className="block text-[11px] text-ink-faint">Consolidado</span>
            <span className="tabular-figure text-sm font-semibold" style={{ color: "var(--status-realizada)" }}>
              {currency.format(batch.consolidatedNet)}
            </span>
          </span>
          <label className="flex items-center gap-2 text-xs font-semibold text-ink-faint">
            <input
              type="checkbox"
              checked={allConsolidated}
              disabled={isPending}
              onChange={(event) => run(() => setBatchConsolidated(batch.id, event.target.checked))}
            />
            Consolidar nota
          </label>
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={isPending}
            onClick={() => run(() => deleteRemittanceBatch(batch.id))}
            aria-label="Excluir nota"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {batch.warnings.length > 0 && (
        <p className="flex items-start gap-2 px-4 pb-3 text-[11px]" style={{ color: "var(--color-accent-2-600)" }}>
          <AlertTriangle size={14} className="mt-px shrink-0" />
          {batch.warnings.join(" ")}
        </p>
      )}
      {error && (
        <p className="px-4 pb-3 text-[11px]" style={{ color: "var(--status-falta)" }}>
          {error}
        </p>
      )}

      {open && (
        <div className="border-t px-4 pb-4" style={{ borderColor: "var(--color-neutral-200)" }}>
          <table className="table w-full">
            <thead>
              <tr>
                <th>Recebível</th>
                <th>Guia</th>
                <th>Beneficiário</th>
                <th>Procedimento</th>
                <th>Sessões</th>
                <th>Apresentado</th>
                <th>Glosa</th>
                <th>Liberado</th>
              </tr>
            </thead>
            <tbody>
              {batch.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={line.consolidated}
                      disabled={isPending}
                      onChange={(event) => run(() => setLineConsolidated(line.id, event.target.checked))}
                      aria-label={`Consolidar guia ${line.guideNumber ?? line.id} na DRE`}
                    />
                  </td>
                  <td className="tabular-figure text-xs">
                    {line.guideNumber ?? "—"}
                    {line.lowConfidence && (
                      <span className="ml-2 text-[10px]" style={{ color: "var(--color-accent-2-600)" }} title="Linha lida do texto corrido do PDF — confira os valores">
                        conferir
                      </span>
                    )}
                  </td>
                  <td className="text-xs">{line.patientName ?? "—"}</td>
                  <td className="tabular-figure text-xs">{line.procedureCode ?? "—"}</td>
                  <td className="tabular-figure text-xs">{line.sessions ?? "—"}</td>
                  <td className="tabular-figure text-xs text-ink-faint">
                    {line.grossAmount === null ? "—" : currency.format(line.grossAmount)}
                  </td>
                  <td className="tabular-figure text-xs" style={{ color: "var(--status-falta)" }}>
                    {line.glosaAmount ? currency.format(line.glosaAmount) : "—"}
                  </td>
                  <td className="tabular-figure text-xs font-semibold">{currency.format(line.netAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
