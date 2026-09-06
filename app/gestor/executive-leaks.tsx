"use client";

import { useState, type ReactNode } from "react";
import type { LeakCard } from "./data";
import { GestorDrilldownDrawer, type DrilldownData } from "@/components/gestor/gestor-drilldown-drawer";

/**
 * Grade dos "4 vazamentos de receita" (Gestor.dc.html) + painel de
 * detalhamento "por origem" com botão de Rastreabilidade Total / Drill-down.
 */
export function ExecutiveLeaks({ leaks, bonusPanel }: { leaks: LeakCard[]; bonusPanel: ReactNode }) {
  const [selectedKey, setSelectedKey] = useState(leaks[0]?.key);
  const selected = leaks.find((l) => l.key === selectedKey) ?? leaks[0];

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<DrilldownData | null>(null);

  const handleOpenDrilldown = (leak: LeakCard) => {
    setDrawerData({
      title: leak.title,
      subtitle: `${leak.kicker} · ${leak.metaLabel}`,
      metricValue: leak.value.toString() + (leak.valueSuffix || ""),
      metricLabel: leak.amountLabel,
      items: leak.breakdown.map((item, idx) => ({
        id: `breakdown-${idx}`,
        title: item.label,
        subtitle: `Ocorrências registradas: ${item.count}`,
        value: `${item.count} un`,
        tag: item.count > 3 ? "Atenção" : "Normal",
        tagType: item.count > 3 ? "danger" : "warning",
        detailUrl: "/gestor/atendimentos",
      })),
    });
    setDrawerOpen(true);
  };

  return (
    <>
      <section className="grid grid-cols-1 gap-8 px-10 pt-8 sm:grid-cols-2 lg:grid-cols-4">
        {leaks.map((leak) => (
          <button
            key={leak.key}
            type="button"
            onClick={() => setSelectedKey(leak.key)}
            className="card elev-sm text-left transition-shadow"
            style={{
              cursor: "pointer",
              outline: leak.key === selectedKey ? "2px solid var(--color-accent-2)" : "none",
              outlineOffset: "-2px",
            }}
          >
            <span className="card-kicker">{leak.kicker}</span>
            <span
              className="tabular-figure"
              style={{ fontFamily: "var(--font-heading)", fontSize: 40, lineHeight: 1, color: "var(--color-accent)" }}
            >
              {leak.value}
              {leak.valueSuffix ?? ""}
            </span>
            <span className="card-title">{leak.title}</span>
            <span className="card-meta">{leak.amountLabel} · {leak.metaLabel}</span>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-15 px-10 pt-12 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0">
              {selected?.kicker} · {selected?.breakdownLabel}
            </h6>
            {selected && (
              <button
                type="button"
                onClick={() => handleOpenDrilldown(selected)}
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 bg-accent/5 px-2.5 py-1 rounded-md border border-accent/20"
              >
                <span>🔍 Rastreabilidade Total (Drill-Down)</span>
              </button>
            )}
          </div>
          <h3 className="mb-4">{selected?.title}</h3>
          <div className="flex flex-col gap-3">
            {(selected?.breakdown.length ?? 0) > 0 ? (
              selected!.breakdown.map((item) => {
                const max = Math.max(...selected!.breakdown.map((b) => b.count), 1);
                return (
                  <div key={item.label} className="grid grid-cols-[140px_1fr_36px] items-center gap-3 text-sm">
                    <span className="truncate font-medium">{item.label}</span>
                    <span style={{ background: "var(--color-divider)", borderRadius: "var(--radius-sm)", height: 10 }}>
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${Math.max(6, (item.count / max) * 100)}%`,
                          background: "var(--color-accent)",
                          borderRadius: "var(--radius-sm)",
                        }}
                      />
                    </span>
                    <span className="tabular-figure text-right font-semibold">{item.count}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-ink-faint">Sem ocorrências no período — nada pra detalhar.</p>
            )}
          </div>
          <p className="mt-5 text-[13px] text-ink-soft">{selected?.note}</p>
        </div>
        {bonusPanel}
      </section>

      {/* Drill-down Drawer Side Sheet */}
      <GestorDrilldownDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data={drawerData}
      />
    </>
  );
}
