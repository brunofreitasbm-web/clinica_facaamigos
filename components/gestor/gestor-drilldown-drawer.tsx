"use client";

import React, { useState } from "react";
import Link from "next/link";

export interface DrilldownItem {
  id: string;
  title: string;
  subtitle?: string;
  tag?: string;
  tagType?: "success" | "warning" | "danger" | "neutral";
  value?: string;
  detailUrl?: string;
}

export interface DrilldownData {
  title: string;
  subtitle: string;
  metricValue?: string;
  metricLabel?: string;
  items: DrilldownItem[];
}

interface GestorDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: DrilldownData | null;
}

export function GestorDrilldownDrawer({ isOpen, onClose, data }: GestorDrilldownDrawerProps) {
  const [filterQuery, setFilterQuery] = useState("");

  if (!isOpen || !data) return null;

  const filteredItems = data.items.filter(
    (item) =>
      item.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  const getBadgeClass = (type?: string) => {
    switch (type) {
      case "danger":
        return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
      case "warning":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
      case "success":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-2xl border-l border-paper-line animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-paper-line px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">
              Rastreabilidade & Drill-Down (§10)
            </div>
            <h2 className="text-xl font-bold text-ink">{data.title}</h2>
            <p className="text-xs text-ink-soft mt-0.5">{data.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-soft hover:bg-paper-subtle hover:text-ink transition-colors"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Metric Summary Bar if present */}
        {data.metricValue && (
          <div className="flex items-center justify-between bg-paper-subtle px-6 py-3 border-b border-paper-line">
            <span className="text-xs font-medium text-ink-soft">{data.metricLabel || "Total consolidado"}</span>
            <span className="text-lg font-bold tabular-figure text-ink">{data.metricValue}</span>
          </div>
        )}

        {/* Filter Input */}
        <div className="px-6 py-3 border-b border-paper-line">
          <input
            type="text"
            placeholder="Filtrar registros fonte por nome, ID ou convênio..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-2xl mb-2">🔍</span>
              <p className="text-sm text-ink-soft">Nenhum registro encontrado para este filtro.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-paper-line bg-paper p-4 hover:border-accent/50 transition-colors shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{item.title}</span>
                    {item.tag && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getBadgeClass(item.tagType)}`}>
                        {item.tag}
                      </span>
                    )}
                  </div>
                  {item.subtitle && <p className="text-xs text-ink-soft">{item.subtitle}</p>}
                </div>

                <div className="flex items-center gap-3">
                  {item.value && (
                    <span className="text-sm font-bold tabular-figure text-ink">{item.value}</span>
                  )}
                  {item.detailUrl && (
                    <Link
                      href={item.detailUrl}
                      className="rounded-md border border-paper-line px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10 transition-colors no-underline"
                    >
                      Ver no módulo →
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-paper-line px-6 py-4 flex items-center justify-between text-xs text-ink-faint bg-paper-subtle">
          <span>{filteredItems.length} registros auditados</span>
          <button
            onClick={onClose}
            className="rounded-md bg-paper border border-paper-line px-4 py-1.5 font-medium text-ink hover:bg-paper-subtle transition-colors"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
}
