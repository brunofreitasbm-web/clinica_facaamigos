"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Search, UserPlus, X, UserX } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PatientFormattedDisplay, PatientStatusBadge } from "@/components/patient-formatted-display";

export interface PatientRow {
  id: string;
  full_name: string;
  status: string | null;
  created_at?: string;
  evaluated_at?: string | null;
  first_session_at?: string | null;
  stage: number;
}

const STAGE_LABEL: Record<number, string> = {
  1: "Paciente sem avaliação agendada",
  2: "Avaliação agendada, aguardando",
  3: "Avaliação feita, sem autorização",
  4: "Autorizado, sem grade montada",
  5: "Ativo — grade montada",
};

interface PatientListClientProps {
  rows: PatientRow[];
}

const PatientListItem = React.memo(function PatientListItem({
  patient,
}: {
  patient: PatientRow;
}) {
  return (
    <Link
      href={`/recepcao/pacientes/${patient.id}`}
      className="group flex items-center justify-between rounded-lg border border-paper-line-strong bg-paper/70 px-4 py-3 text-sm transition-all duration-200 hover:bg-paper-line/40 hover:border-chart hover:translate-x-0.5 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart focus-visible:ring-offset-1"
    >
      <PatientFormattedDisplay
        name={patient.full_name}
        size="md"
        subtitle={
          <span className="text-ink-faint text-xs group-hover:text-ink transition-colors">
            {STAGE_LABEL[patient.stage] ?? "Estágio desconhecido"}
          </span>
        }
      />
      <PatientStatusBadge status={patient.status || "ativo"} size="md" />
    </Link>
  );
});

export function PatientListClient({ rows }: PatientListClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Debounce de 300ms na busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Atalho de teclado (Ctrl + K, Cmd + K ou /) para focar na busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.getAttribute("contenteditable") === "true";

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "/" && !isInputFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filtragem dos pacientes em tempo real
  const filteredRows = useMemo(() => {
    if (!debouncedQuery.trim()) return rows;
    const query = debouncedQuery.toLowerCase().trim();
    return rows.filter((p) => {
      const nameMatch = (p.full_name || "").toLowerCase().includes(query);
      const statusMatch = (p.status || "").toLowerCase().includes(query);
      const stageMatch = (STAGE_LABEL[p.stage] || "").toLowerCase().includes(query);
      return nameMatch || statusMatch || stageMatch;
    });
  }, [rows, debouncedQuery]);

  // Configuração da virtualização com @tanstack/react-virtual
  const rowVirtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // altura aproximada de cada card
    overscan: 5,
  });

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-10 max-w-7xl mx-auto w-full">
      {/* Barra Superior de Ações e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Botão Primário CTA */}
        <Link
          href="/recepcao/pacientes/novo"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#841B4D] hover:bg-[#6c163f] active:bg-[#541131] text-white px-5 py-2.5 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#841B4D] focus-visible:ring-offset-2 shrink-0"
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          <span>Novo paciente (interessado)</span>
        </Link>

        {/* Input da SearchBar com Debounce e Atalho */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar paciente por nome ou estágio... (Ctrl + K)"
            className="w-full rounded-lg border border-paper-line-strong bg-paper/80 pl-10 pr-20 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-all focus:border-chart focus:bg-paper focus:outline-none focus:ring-2 focus:ring-chart/20"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="p-1 rounded-md text-ink-faint hover:text-ink hover:bg-paper-line transition-colors"
                title="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center rounded border border-paper-line-strong bg-paper-line/50 px-1.5 py-0.5 text-[10px] font-mono font-medium text-ink-faint select-none">
              Ctrl K
            </kbd>
          </div>
        </div>
      </div>

      {/* Lista de Pacientes / Virtualizada */}
      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-paper-line-strong bg-paper/30 py-16 px-4 text-center">
          <div className="rounded-full bg-paper-line/50 p-3 mb-3 text-ink-faint">
            <UserX className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-ink mb-1">
            Nenhum paciente encontrado
          </h3>
          <p className="text-sm text-ink-faint max-w-md mb-4">
            {searchQuery
              ? `Não foi possível encontrar nenhum paciente que corresponda ao termo "${searchQuery}".`
              : "Nenhum paciente cadastrado até o momento."}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="inline-flex items-center gap-1.5 rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:border-chart transition-all"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtro de busca
            </button>
          )}
        </div>
      ) : (
        <div
          ref={parentRef}
          className="max-h-[calc(100vh-280px)] min-h-[400px] overflow-auto pr-1"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const patient = filteredRows[virtualRow.index];
              return (
                <div
                  key={patient.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: "8px",
                  }}
                >
                  <PatientListItem patient={patient} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
