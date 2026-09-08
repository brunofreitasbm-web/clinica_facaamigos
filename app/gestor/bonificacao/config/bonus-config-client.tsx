"use client";

import { useMemo, useState, useTransition } from "react";
import type { Role } from "@/lib/roles";
import type { MetricDef } from "@/lib/metric-catalog";
import {
  saveBonusRuleSet,
  runBonusSimulation,
  type RuleSetRow,
  type RuleSetItemDraft,
  type BonusModule,
} from "./actions";
import type { SimResult } from "@/lib/bonus-simulation";

type Props = {
  roles: { value: Role; label: string }[];
  modules: { value: BonusModule; label: string }[];
  catalog: Partial<Record<Role, MetricDef[]>>;
  active: RuleSetRow[];
  history: RuleSetRow[];
};

type DraftItem = RuleSetItemDraft & { selected: boolean };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildDraftFromCatalog(defs: MetricDef[], existing?: RuleSetItemDraft[]): DraftItem[] {
  return defs.map((def) => {
    const found = existing?.find((i) => i.metricKey === def.key);
    return {
      metricKey: def.key,
      weightPct: found?.weightPct ?? 0,
      targetValue: found?.targetValue ?? 0,
      eliminatory: found?.eliminatory ?? Boolean(def.eliminatory),
      selected: Boolean(found),
    };
  });
}

export function BonusConfigClient({ roles, modules, catalog, active, history }: Props) {
  const [role, setRole] = useState<Role>(roles[0]?.value ?? "recepcao");
  const [bonusModule, setBonusModule] = useState<BonusModule>("plr");
  const [validFrom, setValidFrom] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();

  const defs = useMemo(() => catalog[role] ?? [], [catalog, role]);
  const existingSet = useMemo(
    () => active.find((s) => s.role === role && s.module === bonusModule),
    [active, role, bonusModule],
  );
  const [draft, setDraft] = useState<DraftItem[]>(() => buildDraftFromCatalog(defs, existingSet?.items));

  function switchContext(newRole: Role, newModule: BonusModule) {
    setRole(newRole);
    setBonusModule(newModule);
    const newDefs = catalog[newRole] ?? [];
    const found = active.find((s) => s.role === newRole && s.module === newModule);
    setDraft(buildDraftFromCatalog(newDefs, found?.items));
    setSaveMsg(null);
  }

  function updateItem(metricKey: string, patch: Partial<DraftItem>) {
    setDraft((prev) => prev.map((i) => (i.metricKey === metricKey ? { ...i, ...patch } : i)));
  }

  const selectedItems = draft.filter((i) => i.selected);
  const totalWeight = selectedItems.reduce((sum, i) => sum + (i.weightPct || 0), 0);

  function handleSave() {
    setSaveMsg(null);
    const items: RuleSetItemDraft[] = selectedItems.map(({ metricKey, weightPct, targetValue, eliminatory }) => ({
      metricKey,
      weightPct,
      targetValue,
      eliminatory,
    }));
    startSaving(async () => {
      const result = await saveBonusRuleSet({ role, module: bonusModule, validFrom, note, items });
      if (result.success) {
        setSaveMsg({ ok: true, text: "Configuração publicada. Vigência anterior encerrada automaticamente." });
      } else {
        setSaveMsg({ ok: false, text: result.error ?? "Erro ao salvar." });
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* ── Seletor de contexto ─────────────────────────────────────── */}
      <section className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
            Cargo / Função
            <select
              value={role}
              onChange={(e) => switchContext(e.target.value as Role, bonusModule)}
              className="rounded border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
            Módulo
            <select
              value={bonusModule}
              onChange={(e) => switchContext(role, e.target.value as BonusModule)}
              className="rounded border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
            >
              {modules.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {existingSet ? (
          <p className="text-xs text-ink-soft">
            Vigência aberta desde <strong>{existingSet.validFrom}</strong>
            {existingSet.createdByName ? ` · criada por ${existingSet.createdByName}` : ""} · soma de pesos atual:{" "}
            <strong>{existingSet.totalWeight}%</strong>. Publicar abaixo encerra essa vigência e abre uma nova.
          </p>
        ) : (
          <p className="text-xs text-ink-soft">Nenhuma vigência aberta para este cargo/módulo ainda.</p>
        )}
      </section>

      {/* ── Construtor: métricas, pesos, metas ─────────────────────── */}
      <section className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-paper-line pb-3">
          <h2 className="text-lg font-bold text-ink">Métricas, pesos e metas</h2>
          <span className={`text-sm font-semibold ${totalWeight > 100 ? "text-red-600" : "text-ink-soft"}`}>
            Soma dos pesos: {totalWeight.toFixed(1)}% {totalWeight > 100 && "(acima de 100%)"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
              <tr>
                <th className="p-2 w-8"></th>
                <th className="p-2">Métrica</th>
                <th className="p-2 w-24">Peso (%)</th>
                <th className="p-2 w-28">Meta {defs[0]?.unit === "pct" ? "(%)" : ""}</th>
                <th className="p-2 w-24">Eliminatória</th>
                <th className="p-2 w-28">Cálculo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-line">
              {defs.map((def) => {
                const item = draft.find((i) => i.metricKey === def.key)!;
                return (
                  <tr key={def.key} className={item.selected ? "" : "opacity-60"}>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => updateItem(def.key, { selected: e.target.checked })}
                      />
                    </td>
                    <td className="p-2 font-medium text-ink">{def.label}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={item.weightPct}
                        disabled={!item.selected}
                        onChange={(e) => updateItem(def.key, { weightPct: Number(e.target.value) })}
                        className="w-16 rounded border border-paper-line-strong bg-paper px-1.5 py-1 text-ink disabled:opacity-40"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step={0.1}
                        value={item.targetValue}
                        disabled={!item.selected}
                        onChange={(e) => updateItem(def.key, { targetValue: Number(e.target.value) })}
                        className="w-20 rounded border border-paper-line-strong bg-paper px-1.5 py-1 text-ink disabled:opacity-40"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={item.eliminatory}
                        disabled={!item.selected}
                        onChange={(e) => updateItem(def.key, { eliminatory: e.target.checked })}
                      />
                    </td>
                    <td className="p-2">
                      {def.computed ? (
                        <span className="text-emerald-700 dark:text-emerald-400">✓ tem cálculo</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">⚠ sem pipeline</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-paper-line">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
            Início da vigência
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="rounded border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="flex flex-1 min-w-[220px] flex-col gap-1 text-xs font-semibold text-ink-soft">
            Observação (opcional)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex.: recalibrado após 90 dias de dados reais"
              className="rounded border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || selectedItems.length === 0 || totalWeight > 100}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {isSaving ? "Publicando…" : "Publicar nova vigência"}
          </button>
        </div>
        {saveMsg && (
          <p className={`text-xs font-medium ${saveMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{saveMsg.text}</p>
        )}
      </section>

      {/* ── Simulação ───────────────────────────────────────────────── */}
      <SimulationPanel role={role} draft={selectedItems} />

      {/* ── Histórico de vigências ──────────────────────────────────── */}
      <section className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-ink border-b border-paper-line pb-3">Histórico de vigências</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-soft">Nenhuma configuração publicada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
                <tr>
                  <th className="p-2">Cargo</th>
                  <th className="p-2">Módulo</th>
                  <th className="p-2">Vigência</th>
                  <th className="p-2">Métricas</th>
                  <th className="p-2">Publicado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="p-2 font-medium text-ink">{roles.find((r) => r.value === h.role)?.label ?? h.role}</td>
                    <td className="p-2 text-ink-soft">{modules.find((m) => m.value === h.module)?.label ?? h.module}</td>
                    <td className="p-2 text-ink-soft">
                      {h.validFrom} → {h.validTo ?? "vigente"}
                    </td>
                    <td className="p-2 text-ink-soft">{h.items.length} ({h.totalWeight}%)</td>
                    <td className="p-2 text-ink-soft">{h.createdByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function currentMonthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function SimulationPanel({ role, draft }: { role: Role; draft: DraftItem[] }) {
  const bounds = currentMonthBounds();
  const [periodStart, setPeriodStart] = useState(bounds.start);
  const [periodEnd, setPeriodEnd] = useState(bounds.end);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runSim() {
    setError(null);
    setResult(null);
    const numericOverrides: Record<string, number> = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (value.trim() !== "" && Number.isFinite(Number(value))) {
        numericOverrides[key] = Number(value) / 100;
      }
    }
    startTransition(async () => {
      const res = await runBonusSimulation({
        role,
        items: draft.map(({ metricKey, weightPct, targetValue, eliminatory }) => ({
          metricKey,
          weightPct,
          targetValue,
          eliminatory,
        })),
        periodStart,
        periodEnd,
        overrides: numericOverrides,
      });
      if ("error" in res) setError(res.error);
      else setResult(res);
    });
  }

  return (
    <section className="rounded-xl border border-paper-line bg-paper p-6 shadow-sm space-y-4">
      <div className="border-b border-paper-line pb-3">
        <span className="text-xs font-semibold text-accent uppercase tracking-wider">Antes de publicar</span>
        <h2 className="text-lg font-bold text-ink">Simular esta configuração num período</h2>
        <p className="text-xs text-ink-soft mt-1">
          Usa dado real do período pra métricas com cálculo ao vivo ou fechado; pra métricas sem pipeline, digite um
          valor hipotético abaixo (cenário &quot;e se&quot;) — sem override, elas ficam &quot;sem dado&quot; e não
          entram na conta.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
          Início do período
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="rounded border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
          Fim do período (exclusivo)
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="rounded border border-paper-line-strong bg-paper px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <button
          type="button"
          onClick={runSim}
          disabled={isPending || draft.length === 0}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {isPending ? "Simulando…" : "▶ Simular"}
        </button>
        {draft.length === 0 && <span className="text-xs text-ink-faint">Selecione métricas acima primeiro.</span>}
      </div>

      {draft.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-paper-line">
          {draft.map((d) => (
            <label key={d.metricKey} className="flex flex-col gap-1 text-[11px] text-ink-soft">
              Override {d.metricKey} (%)
              <input
                type="number"
                step={0.1}
                placeholder="opcional"
                value={overrides[d.metricKey] ?? ""}
                onChange={(e) => setOverrides((prev) => ({ ...prev, [d.metricKey]: e.target.value }))}
                className="w-28 rounded border border-paper-line-strong bg-paper px-2 py-1 text-ink"
              />
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      {result && (
        <div className="space-y-3 pt-2">
          <div
            className={`rounded-lg p-4 text-sm font-semibold ${
              result.eliminated
                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            }`}
          >
            {result.eliminated
              ? `Zerado por cláusula eliminatória: ${result.eliminatedBy.join(", ")}`
              : `Atingimento ponderado simulado: ${result.weightedPct}%`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-subtle border-b border-paper-line font-semibold text-ink-soft uppercase">
                <tr>
                  <th className="p-2">Métrica</th>
                  <th className="p-2">Peso</th>
                  <th className="p-2">Meta</th>
                  <th className="p-2">Realizado</th>
                  <th className="p-2">Fonte</th>
                  <th className="p-2">Contribuição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {result.items.map((it) => (
                  <tr key={it.metricKey}>
                    <td className="p-2 font-medium text-ink">
                      {it.label}
                      {it.eliminatory && <span className="ml-1 text-red-600">⚑</span>}
                    </td>
                    <td className="p-2 text-ink-soft">{it.weightPct}%</td>
                    <td className="p-2 text-ink-soft">{it.targetLabel}</td>
                    <td className="p-2 text-ink-soft">{it.actualLabel}</td>
                    <td className="p-2 text-ink-faint">
                      {{ override: "manual", live: "ao vivo", snapshot: "fechado", sem_dado: "—" }[it.source]}
                    </td>
                    <td className="p-2 font-semibold text-ink">
                      {it.actual == null ? "—" : `${((it.weightPct * it.contributionPct) / 100).toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
