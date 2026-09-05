"use client";

import { useState, useTransition } from "react";
import { generateGuiasXml } from "./actions";
import type { GuiaPeriodGroup } from "./data";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function GuiaPeriodCard({ group }: { group: GuiaPeriodGroup }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(group.guias.map((g) => g.id));
  const [generatedXml, setGeneratedXml] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalSelected = group.guias.filter((g) => selectedIds.includes(g.id)).reduce((acc, g) => acc + g.valorTotal, 0);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateGuiasXml(group.billingPeriodId, selectedIds);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setGeneratedXml(result.xml);
      setFilename(result.filename);
    });
  }

  function handleDownload() {
    if (!generatedXml) return;
    const blob = new Blob([generatedXml], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-lg border border-paper-line-strong bg-white overflow-hidden shadow-sm">
      <div className="p-4 border-b border-paper-line bg-paper flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">{group.insurerName}</h3>
          <p className="text-xs text-ink-soft">
            Competência {group.competenceLabel}
            {group.ansCode ? ` · ANS ${group.ansCode}` : ""}
            {!group.providerCode && (
              <span className="ml-2 text-status-negative-text">
                código do prestador não cadastrado — cadastre em /gestor/convenios antes de enviar
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-soft">
            {selectedIds.length} guia(s) · {currency.format(totalSelected)}
          </span>
          <button
            onClick={handleGenerate}
            disabled={isPending || selectedIds.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-chart px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-chart-strong transition-colors disabled:opacity-50"
          >
            {isPending ? "Gerando…" : `⚡ Gerar Lote XML (${selectedIds.length})`}
          </button>
        </div>
      </div>

      {error && <p className="px-4 pt-3 text-xs text-status-negative-text">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-ink">
          <thead className="bg-paper border-b border-paper-line text-ink-faint font-medium uppercase">
            <tr>
              <th className="p-3.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.length === group.guias.length && group.guias.length > 0}
                  onChange={(e) => setSelectedIds(e.target.checked ? group.guias.map((g) => g.id) : [])}
                  className="rounded border-paper-line-strong"
                />
              </th>
              <th className="p-3.5">Nº Guia</th>
              <th className="p-3.5">Paciente</th>
              <th className="p-3.5">Carteirinha</th>
              <th className="p-3.5">Procedimento</th>
              <th className="p-3.5">Data Sessão</th>
              <th className="p-3.5 text-right">Valor (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-line">
            {group.guias.map((guia) => (
              <tr key={guia.id} className="hover:bg-paper/60 transition-colors">
                <td className="p-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(guia.id)}
                    onChange={() => toggleSelect(guia.id)}
                    className="rounded border-paper-line-strong"
                  />
                </td>
                <td className="p-3.5 font-mono font-medium text-chart">{guia.numeroGuiaPrestador}</td>
                <td className="p-3.5 font-semibold text-ink">{guia.nomeBeneficiario}</td>
                <td className="p-3.5 font-mono text-[11px] text-ink-soft">{guia.numeroCarteira || "—"}</td>
                <td className="p-3.5">
                  <div className="font-mono text-[11px] text-chart font-semibold">{guia.procedimentoCodigo}</div>
                  <div className="text-ink-soft">{guia.procedimentoDescricao}</div>
                </td>
                <td className="p-3.5 font-mono">{guia.dataAtendimento}</td>
                <td className="p-3.5 text-right font-mono font-bold text-status-positive">{currency.format(guia.valorTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {generatedXml && (
        <div className="border-t border-status-positive bg-status-positive-soft/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-status-positive-text">✅ Arquivo XML TISS gerado</h4>
              <p className="text-xs text-ink-soft">Competência marcada como enviada — pronta para envio no portal da operadora.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="rounded-md bg-status-positive px-4 py-2 text-xs font-semibold text-white hover:bg-status-positive-text transition-colors"
              >
                📥 Baixar XML
              </button>
              <button
                onClick={() => setGeneratedXml(null)}
                className="rounded-md border border-paper-line-strong bg-white px-3 py-2 text-xs font-medium text-ink hover:bg-paper"
              >
                Fechar
              </button>
            </div>
          </div>
          <pre className="max-h-60 overflow-y-auto rounded-md bg-ink p-4 text-[11px] text-paper font-mono leading-relaxed">
            {generatedXml}
          </pre>
        </div>
      )}
    </div>
  );
}

export function GuiasClient({ groups }: { groups: GuiaPeriodGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-paper-line bg-white p-8 text-center text-sm text-ink-faint shadow-sm">
        Nenhuma guia pendente de envio. Feche uma competência em{" "}
        <a href="/faturamento/competencias" className="text-chart hover:underline">
          Faturamento → Competência
        </a>{" "}
        para gerar guias aqui.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <GuiaPeriodCard key={group.billingPeriodId} group={group} />
      ))}
    </div>
  );
}
