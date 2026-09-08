"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import type { TissValidationIssue } from "@/lib/tiss/pre-validate";

export interface GuiaItem {
  id: string;
  numeroGuiaPrestador: string;
  patientId?: string | null;
  nomeBeneficiario: string;
  numeroCarteira?: string | null;
  procedimentoCodigo: string;
  procedimentoDescricao: string;
  dataAtendimento: string;
  valorTotal: number;
}

export interface GuiasTableProps {
  guias: GuiaItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  issuesByItem: Map<string, TissValidationIssue[]>;
  rowHeight?: number;
  maxContainerHeight?: number;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function GuiasTable({
  guias,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  issuesByItem,
  rowHeight = 56,
  maxContainerHeight = 480,
}: GuiasTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(maxContainerHeight);

  // Calcula a janela de renderização virtual com base na rolagem
  const totalCount = guias.length;
  const totalHeight = totalCount * rowHeight;

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let rAFId: number;

    const handleScroll = () => {
      cancelAnimationFrame(rAFId);
      rAFId = requestAnimationFrame(() => {
        setScrollTop(element.scrollTop);
      });
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setContainerHeight(Math.min(entry.contentRect.height, maxContainerHeight));
        }
      }
    });

    element.addEventListener("scroll", handleScroll, { passive: true });
    resizeObserver.observe(element);

    return () => {
      cancelAnimationFrame(rAFId);
      element.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [maxContainerHeight]);

  // Buffer de segurança para rolagem sem flicker (5 itens acima e abaixo)
  const buffer = 5;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
  const endIndex = Math.min(
    totalCount - 1,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + buffer
  );

  const visibleGuias = useMemo(() => {
    const items = [];
    for (let i = startIndex; i <= endIndex && i < totalCount; i++) {
      items.push({ index: i, guia: guias[i] });
    }
    return items;
  }, [guias, startIndex, endIndex, totalCount]);

  const allSelected = useMemo(
    () => guias.length > 0 && selectedIds.length === guias.length,
    [guias.length, selectedIds.length]
  );

  const handleCheckboxAll = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSelectAll(e.target.checked);
    },
    [onSelectAll]
  );

  const offsetY = startIndex * rowHeight;

  return (
    <div className="w-full border-t border-paper-line bg-white shadow-xs">
      {/* Cabeçalho da Tabela (Fixo) */}
      <div className="grid grid-cols-12 items-center border-b border-paper-line bg-paper text-[11px] font-semibold uppercase tracking-wider text-ink-faint py-3 px-4">
        <div className="col-span-1 text-center">
          <input
            type="checkbox"
            aria-label="Selecionar todas as guias"
            checked={allSelected}
            onChange={handleCheckboxAll}
            className="h-4 w-4 rounded border-paper-line-strong text-chart focus:ring-chart"
          />
        </div>
        <div className="col-span-2">Nº Guia</div>
        <div className="col-span-3">Paciente</div>
        <div className="col-span-2">Carteirinha</div>
        <div className="col-span-2">Procedimento</div>
        <div className="col-span-1 text-right">Valor</div>
        <div className="col-span-1 text-center">Status</div>
      </div>

      {/* Viewport Virtualizado */}
      <div
        ref={containerRef}
        style={{ height: Math.min(totalHeight, maxContainerHeight), maxHeight: maxContainerHeight }}
        className="overflow-y-auto relative scroll-smooth focus:outline-hidden"
        tabIndex={0}
        aria-label="Tabela de guias TISS com rolagem virtualizada"
      >
        <div style={{ height: totalHeight, width: "100%", position: "relative" }}>
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {visibleGuias.map(({ index, guia }) => {
              const rowIssues = issuesByItem.get(guia.id) ?? [];
              const rowHasBlocking = rowIssues.some((i) => i.severity === "bloqueante");
              const rowHasWarning = rowIssues.some((i) => i.severity === "aviso");
              const isSelected = selectedIds.includes(guia.id);

              return (
                <div
                  key={guia.id}
                  style={{ height: rowHeight }}
                  className={`grid grid-cols-12 items-center border-b border-paper-line/60 px-4 text-xs transition-colors ${
                    isSelected ? "bg-chart/5" : ""
                  } ${
                    rowHasBlocking
                      ? "bg-status-negative-soft/20"
                      : rowHasWarning
                      ? "bg-gold/10"
                      : "hover:bg-paper/70"
                  }`}
                >
                  <div className="col-span-1 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar guia ${guia.numeroGuiaPrestador}`}
                      checked={isSelected}
                      onChange={() => onToggleSelect(guia.id)}
                      className="h-4 w-4 rounded border-paper-line-strong text-chart focus:ring-chart"
                    />
                  </div>

                  <div className="col-span-2 font-mono font-medium text-chart truncate">
                    {guia.numeroGuiaPrestador}
                  </div>

                  <div className="col-span-3 font-semibold text-ink truncate">
                    {guia.patientId ? (
                      <Link
                        href={`/recepcao/pacientes/${guia.patientId}/gestao`}
                        className="hover:underline hover:text-chart transition-colors"
                      >
                        {guia.nomeBeneficiario}
                      </Link>
                    ) : (
                      guia.nomeBeneficiario
                    )}
                  </div>

                  <div className="col-span-2 font-mono text-[11px] text-ink-soft truncate">
                    {guia.numeroCarteira || "—"}
                  </div>

                  <div className="col-span-2 truncate">
                    <span className="font-mono text-[11px] text-chart font-semibold block truncate">
                      {guia.procedimentoCodigo}
                    </span>
                    <span className="text-[11px] text-ink-soft block truncate">
                      {guia.procedimentoDescricao}
                    </span>
                  </div>

                  <div className="col-span-1 text-right font-mono font-bold text-status-positive">
                    {currency.format(guia.valorTotal)}
                  </div>

                  <div className="col-span-1 text-center">
                    {rowHasBlocking ? (
                      <span className="inline-flex items-center rounded-full bg-status-negative-soft px-2 py-0.5 text-[10px] font-semibold text-status-negative-text">
                        🚫 Bloq.
                      </span>
                    ) : rowHasWarning ? (
                      <span className="inline-flex items-center rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-ink">
                        ⚠️ Aviso
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-status-positive-soft px-2 py-0.5 text-[10px] font-semibold text-status-positive-text">
                        ✓ Ok
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
