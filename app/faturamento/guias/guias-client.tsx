"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { generateGuiasXml } from "./actions";
import type { GuiaPeriodGroup } from "./data";
import type { TissValidationIssue } from "@/lib/tiss/pre-validate";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ISSUE_LABEL: Record<string, string> = {
  campo_obrigatorio_faltando: "Campo obrigatório vazio",
  sem_autorizacao_vinculada: "Sem guia vinculada",
  sem_evolucao: "Sem evolução registrada",
  evolucao_nao_assinada: "Evolução não assinada",
  guia_negada: "Guia negada",
  guia_vencida: "Guia vencida",
  guia_perto_de_vencer: "Guia perto de vencer",
  guia_sem_sessoes: "Guia sem sessões",
  guia_perto_do_limite: "Guia perto do limite",
  guia_sem_dados_para_checagem: "Guia não verificável",
  procedimento_fora_da_tabela: "Procedimento fora da tabela",
  carteirinha_vencida: "Carteirinha vencida",
  carteirinha_perto_de_vencer: "Carteirinha perto de vencer",
};

/**
 * Painel de problemas da pré-validação (lib/tiss/pre-validate.ts), agrupado
 * por severidade. Usado tanto ANTES de tentar exportar (com base nas guias
 * selecionadas na hora, calculado em memória a partir de `group.issues` que
 * já veio pronto do servidor) quanto DEPOIS de uma tentativa bloqueada pela
 * action `generateGuiasXml`.
 */
function IssuesPanel({
  issues,
  guiaById,
  title,
}: {
  issues: TissValidationIssue[];
  guiaById: Map<string, GuiaPeriodGroup["guias"][number]>;
  title: string;
}) {
  if (issues.length === 0) return null;
  const bloqueantes = issues.filter((i) => i.severity === "bloqueante");
  const avisos = issues.filter((i) => i.severity === "aviso");

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
      {bloqueantes.length > 0 && (
        <ul className="space-y-1.5 rounded-md border border-status-negative bg-status-negative-soft/40 p-3">
          {bloqueantes.map((it, idx) => {
            const guia = guiaById.get(it.billingItemId);
            return (
              <li key={`${it.billingItemId}-${it.code}-${idx}`} className="text-xs text-status-negative-text">
                <span className="font-semibold">🚫 {ISSUE_LABEL[it.code] ?? it.code}</span>
                {guia && <span className="text-ink-soft"> — {guia.nomeBeneficiario} (guia {guia.numeroGuiaPrestador})</span>}
                {guia?.patientId && (
                  <>
                    {" "}
                    <Link
                      href={`/recepcao/pacientes/${guia.patientId}/gestao`}
                      className="underline decoration-dotted hover:text-status-negative"
                    >
                      ver paciente
                    </Link>
                  </>
                )}
                <div className="text-ink-soft">{it.message}</div>
              </li>
            );
          })}
        </ul>
      )}
      {avisos.length > 0 && (
        <ul className="space-y-1.5 rounded-md border border-gold bg-gold/10 p-3">
          {avisos.map((it, idx) => {
            const guia = guiaById.get(it.billingItemId);
            return (
              <li key={`${it.billingItemId}-${it.code}-${idx}`} className="text-xs text-ink">
                <span className="font-semibold">⚠️ {ISSUE_LABEL[it.code] ?? it.code}</span>
                {guia && <span className="text-ink-soft"> — {guia.nomeBeneficiario} (guia {guia.numeroGuiaPrestador})</span>}
                {guia?.patientId && (
                  <>
                    {" "}
                    <Link href={`/recepcao/pacientes/${guia.patientId}/gestao`} className="underline decoration-dotted hover:text-chart">
                      ver paciente
                    </Link>
                  </>
                )}
                <div className="text-ink-soft">{it.message}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GuiaPeriodCard({ group }: { group: GuiaPeriodGroup }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(group.guias.map((g) => g.id));
  const [generatedXml, setGeneratedXml] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [warnings, setWarnings] = useState<TissValidationIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attemptIssues, setAttemptIssues] = useState<TissValidationIssue[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const guiaById = useMemo(() => new Map(group.guias.map((g) => [g.id, g])), [group.guias]);

  const totalSelected = group.guias.filter((g) => selectedIds.includes(g.id)).reduce((acc, g) => acc + g.valorTotal, 0);

  // Pré-validação das guias selecionadas, recalculada a cada mudança de seleção
  // a partir do que o servidor já calculou em getPendingGuias — mostra o
  // problema ANTES de a pessoa clicar em gerar.
  const selectedIssues = useMemo(
    () => group.issues.filter((i) => selectedIds.includes(i.billingItemId)),
    [group.issues, selectedIds],
  );
  const hasBlocking = selectedIssues.some((i) => i.severity === "bloqueante");
  const issuesByItem = useMemo(() => {
    const map = new Map<string, TissValidationIssue[]>();
    for (const it of group.issues) {
      const list = map.get(it.billingItemId) ?? [];
      list.push(it);
      map.set(it.billingItemId, list);
    }
    return map;
  }, [group.issues]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function handleGenerate(force = false) {
    setError(null);
    setAttemptIssues(null);
    startTransition(async () => {
      const result = await generateGuiasXml(group.billingPeriodId, selectedIds, force);
      if (!result.success) {
        setError(result.error);
        setAttemptIssues(result.issues ?? null);
        return;
      }
      setGeneratedXml(result.xml);
      setFilename(result.filename);
      setWarnings(result.warnings);
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

  // Se a última tentativa só trouxe avisos (nenhum bloqueante), oferece o
  // botão de "gerar mesmo assim" — quem decide seguir com o risco de glosa é
  // a pessoa faturista, não o sistema.
  const attemptHasOnlyWarnings = attemptIssues !== null && attemptIssues.length > 0 && !attemptIssues.some((i) => i.severity === "bloqueante");

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
                código do prestador não cadastrado — cadastre em /gestor/cadastros/convenios antes de enviar
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-soft">
            {selectedIds.length} guia(s) · {currency.format(totalSelected)}
          </span>
          <button
            onClick={() => handleGenerate(false)}
            disabled={isPending || selectedIds.length === 0}
            title={hasBlocking ? "Há problema(s) bloqueante(s) na seleção — corrija antes de gerar." : undefined}
            className="inline-flex items-center gap-2 rounded-md bg-chart px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-chart-strong transition-colors disabled:opacity-50"
          >
            {isPending ? "Verificando…" : `⚡ Gerar Lote XML (${selectedIds.length})`}
          </button>
        </div>
      </div>

      {/* Pré-validação ANTES da tentativa: mostra o que já se sabe sobre a seleção atual */}
      <div className="px-4 pt-3">
        <IssuesPanel issues={selectedIssues} guiaById={guiaById} title="Pré-validação da seleção atual" />
      </div>

      {error && (
        <div className="px-4 pt-3 space-y-3">
          <p className="text-xs text-status-negative-text">{error}</p>
          {attemptIssues && (
            <IssuesPanel issues={attemptIssues} guiaById={guiaById} title="Problemas encontrados na tentativa de geração" />
          )}
          {attemptHasOnlyWarnings && (
            <button
              onClick={() => handleGenerate(true)}
              disabled={isPending}
              className="rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs font-semibold text-ink hover:bg-gold/20 disabled:opacity-50"
            >
              Gerar mesmo assim (ciente dos avisos)
            </button>
          )}
        </div>
      )}

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
              <th className="p-3.5">Validação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-line">
            {group.guias.map((guia) => {
              const rowIssues = issuesByItem.get(guia.id) ?? [];
              const rowHasBlocking = rowIssues.some((i) => i.severity === "bloqueante");
              const rowHasWarning = rowIssues.some((i) => i.severity === "aviso");
              return (
                <tr
                  key={guia.id}
                  className={`hover:bg-paper/60 transition-colors ${rowHasBlocking ? "bg-status-negative-soft/20" : rowHasWarning ? "bg-gold/5" : ""}`}
                >
                  <td className="p-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(guia.id)}
                      onChange={() => toggleSelect(guia.id)}
                      className="rounded border-paper-line-strong"
                    />
                  </td>
                  <td className="p-3.5 font-mono font-medium text-chart">{guia.numeroGuiaPrestador}</td>
                  <td className="p-3.5 font-semibold text-ink">
                    {guia.patientId ? (
                      <Link href={`/recepcao/pacientes/${guia.patientId}/gestao`} className="hover:underline">
                        {guia.nomeBeneficiario}
                      </Link>
                    ) : (
                      guia.nomeBeneficiario
                    )}
                  </td>
                  <td className="p-3.5 font-mono text-[11px] text-ink-soft">{guia.numeroCarteira || "—"}</td>
                  <td className="p-3.5">
                    <div className="font-mono text-[11px] text-chart font-semibold">{guia.procedimentoCodigo}</div>
                    <div className="text-ink-soft">{guia.procedimentoDescricao}</div>
                  </td>
                  <td className="p-3.5 font-mono">{guia.dataAtendimento}</td>
                  <td className="p-3.5 text-right font-mono font-bold text-status-positive">{currency.format(guia.valorTotal)}</td>
                  <td className="p-3.5">
                    {rowHasBlocking ? (
                      <span className="inline-flex items-center rounded-full bg-status-negative-soft px-2 py-0.5 text-[10px] font-semibold text-status-negative-text">
                        🚫 {rowIssues.filter((i) => i.severity === "bloqueante").length} bloqueante(s)
                      </span>
                    ) : rowHasWarning ? (
                      <span className="inline-flex items-center rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-ink">
                        ⚠️ {rowIssues.length} aviso(s)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-status-positive-soft px-2 py-0.5 text-[10px] font-semibold text-status-positive-text">
                        ✓ ok
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
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
          {warnings.length > 0 && (
            <IssuesPanel issues={warnings} guiaById={guiaById} title="Enviado com os seguintes avisos (risco de glosa)" />
          )}
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
        <Link href="/faturamento/competencias" className="text-chart hover:underline">
          Faturamento → Competência
        </Link>{" "}
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
