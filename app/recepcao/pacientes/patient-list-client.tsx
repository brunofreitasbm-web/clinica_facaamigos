"use client";

import React, { useState, useEffect, useRef, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  UserPlus,
  X,
  UserX,
  Eye,
  Pencil,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
} from "lucide-react";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import { PatientFormattedDisplay, PatientStatusBadge } from "@/components/patient-formatted-display";
import { formatDateBR } from "@/lib/format";
import { inactivatePatient } from "./actions";

export interface PatientRow {
  id: string;
  full_name: string;
  status: string | null;
  birth_date?: string | null;
  created_at?: string;
  evaluated_at?: string | null;
  first_session_at?: string | null;
  cpf?: string | null;
  guardian_name?: string | null;
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

/**
 * Componente de Tooltip acessível para botões de ação
 */
function ActionTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="group/tooltip relative inline-flex items-center">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:flex group-focus-within/tooltip:flex flex-col items-center z-30 animate-in fade-in duration-150">
        <span className="whitespace-nowrap rounded bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg">
          {text}
        </span>
        <span className="h-1.5 w-1.5 -mt-1 rotate-45 bg-slate-900"></span>
      </div>
    </div>
  );
}

/**
 * Modal de Confirmação para inativação de paciente
 */
function InactivateConfirmModal({
  isOpen,
  patientName,
  isPending,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  patientName: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-xl border border-paper-line-strong bg-paper p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-rose-100 dark:bg-rose-950/80 p-3 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">Inativar Paciente</h3>
            <p className="text-xs text-ink-faint">Confirmação de alteração de status</p>
          </div>
        </div>

        <p className="text-sm text-ink-soft leading-relaxed">
          Tem certeza que deseja inativar o paciente{" "}
          <strong className="font-semibold text-ink">{patientName}</strong>?
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-paper-line-strong bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-paper-line transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white px-4 py-2 text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Inativando..." : "Confirmar Inativação"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Item individual de paciente (linha de tabela clicável para abrir o prontuário)
 */
export const PatientListItem = React.memo(function PatientListItem({
  patient,
  onInactivate,
}: {
  patient: PatientRow;
  onInactivate: (p: PatientRow) => void;
}) {
  const router = useRouter();

  const displayDate = patient.birth_date
    ? formatDateBR(patient.birth_date)
    : patient.created_at
    ? formatDateBR(patient.created_at)
    : "—";

  const handleCardClick = () => {
    router.push(`/recepcao/pacientes/${patient.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      role="button"
      tabIndex={0}
      className="group flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-paper-line-strong bg-paper/70 px-4 py-3 text-sm transition-all duration-150 hover:bg-[#841B4D]/5 hover:border-[#841B4D]/40 hover:shadow-xs cursor-pointer gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#841B4D]"
    >
      {/* Coluna 1 a 3: Dados e status do Paciente */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 flex-1 group/link">
        {/* Coluna 1: Nome e Informações */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <PatientFormattedDisplay
            name={patient.full_name}
            size="md"
            subtitle={
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-faint">
                <span className="group-hover/link:text-[#841B4D] transition-colors font-medium">
                  {STAGE_LABEL[patient.stage] ?? "Estágio desconhecido"}
                </span>
                {patient.guardian_name && (
                  <>
                    <span>•</span>
                    <span>Resp: {patient.guardian_name}</span>
                  </>
                )}
                {patient.cpf && (
                  <>
                    <span>•</span>
                    <span>CPF: {patient.cpf}</span>
                  </>
                )}
              </div>
            }
          />
        </div>

        {/* Coluna 2: Data de Nascimento */}
        <div className="flex items-center gap-1.5 text-xs text-ink-soft font-mono shrink-0 sm:px-3">
          <Calendar className="h-3.5 w-3.5 text-ink-faint shrink-0" />
          <span>Nasc: {displayDate}</span>
        </div>

        {/* Coluna 3: Status Badge */}
        <div className="shrink-0 flex items-center">
          <PatientStatusBadge status={patient.status || "ativo"} size="md" />
        </div>
      </div>

      {/* Coluna 4: Célula de Ações com Tooltips (e.stopPropagation para isolar ações) */}
      <div
        className="flex items-center gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-paper-line-strong/50"
        onClick={(e) => e.stopPropagation()}
      >
        <ActionTooltip text="Visualizar Prontuário">
          <Link
            href={`/recepcao/pacientes/${patient.id}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md text-ink-faint hover:text-[#841B4D] hover:bg-[#841B4D]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#841B4D]"
            aria-label="Visualizar Prontuário"
          >
            <Eye className="h-4 w-4" />
          </Link>
        </ActionTooltip>

        <ActionTooltip text="Editar Cadastro">
          <Link
            href={`/recepcao/pacientes/${patient.id}/gestao`}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md text-ink-faint hover:text-[#841B4D] hover:bg-[#841B4D]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#841B4D]"
            aria-label="Editar Cadastro"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </ActionTooltip>

        <ActionTooltip text="Inativar Paciente">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onInactivate(patient);
            }}
            className="p-1.5 rounded-md text-ink-faint hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 cursor-pointer"
            aria-label="Inativar Paciente"
          >
            <UserX className="h-4 w-4" />
          </button>
        </ActionTooltip>
      </div>
    </div>
  );
});

interface VirtualizedItemData {
  items: PatientRow[];
  onInactivate: (p: PatientRow) => void;
}

const VirtualizedPatientRow = React.memo(({ index, style, data }: ListChildComponentProps<VirtualizedItemData>) => {
  const patient = data.items[index];
  if (!patient) return null;
  return (
    <div style={{ ...style, paddingBottom: "8px" }}>
      <PatientListItem patient={patient} onInactivate={data.onInactivate} />
    </div>
  );
});
VirtualizedPatientRow.displayName = "VirtualizedPatientRow";

export function PatientListClient({ rows }: PatientListClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Estado para Modal de Confirmação de Inativação
  const [targetPatient, setTargetPatient] = useState<PatientRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce de 300ms na busca com reset de página
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Atalhos de teclado (Ctrl + K, Cmd + K ou /) para focar na busca
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

  // Filtragem dos pacientes por busca (nome, responsável, CPF) e status
  const filteredRows = useMemo(() => {
    return rows.filter((p) => {
      // Filtro de Status
      if (statusFilter !== "todos") {
        const normStatus = (p.status || "ativo").toLowerCase();
        if (statusFilter === "ativo" && normStatus !== "ativo") return false;
        if (statusFilter === "avaliacao" && !normStatus.includes("avaliacao")) return false;
        if (statusFilter === "inativo" && normStatus !== "inativo") return false;
      }

      // Filtro de Busca (Nome, Responsável, CPF, Estágio)
      if (!debouncedQuery.trim()) return true;
      const query = debouncedQuery.toLowerCase().trim();
      const nameMatch = (p.full_name || "").toLowerCase().includes(query);
      const guardianMatch = (p.guardian_name || "").toLowerCase().includes(query);
      const cpfMatch = (p.cpf || "").replace(/\D/g, "").includes(query.replace(/\D/g, ""));
      const statusMatch = (p.status || "").toLowerCase().includes(query);
      const stageMatch = (STAGE_LABEL[p.stage] || "").toLowerCase().includes(query);

      return nameMatch || guardianMatch || cpfMatch || statusMatch || stageMatch;
    });
  }, [rows, debouncedQuery, statusFilter]);

  // Paginação dos dados filtrados
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return filteredRows; // Sem limite (exibir todos)
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = pageSize > 0 ? Math.ceil(filteredRows.length / pageSize) : 1;

  // Repasse otimizado de dados via itemData para react-window
  const itemData = useMemo<VirtualizedItemData>(
    () => ({
      items: paginatedRows,
      onInactivate: (p: PatientRow) => setTargetPatient(p),
    }),
    [paginatedRows]
  );

  const handleConfirmInactivate = () => {
    if (!targetPatient) return;

    startTransition(async () => {
      const res = await inactivatePatient(targetPatient.id);
      if (res.success) {
        setTargetPatient(null);
      } else {
        alert(res.error || "Houve um erro ao inativar o paciente.");
      }
    });
  };

  const startRecord = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = pageSize > 0 ? Math.min(currentPage * pageSize, filteredRows.length) : filteredRows.length;

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-10 max-w-7xl mx-auto w-full">
      {/* Modal de Confirmação de Inativação */}
      <InactivateConfirmModal
        isOpen={!!targetPatient}
        patientName={targetPatient?.full_name || ""}
        isPending={isPending}
        onConfirm={handleConfirmInactivate}
        onClose={() => setTargetPatient(null)}
      />

      {/* Barra Superior: Botão CTA e Controles de Busca e Filtros */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Botão Primário CTA */}
        <Link
          href="/recepcao/pacientes/novo"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#841B4D] hover:bg-[#6c163f] active:bg-[#541131] text-white px-5 py-2.5 text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#841B4D] focus-visible:ring-offset-2 shrink-0"
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          <span>Novo paciente (interessado)</span>
        </Link>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 lg:max-w-2xl">
          {/* Componente de Busca com Debounce de 300ms */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint pointer-events-none" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, responsável ou CPF... (Ctrl + K)"
              className="w-full rounded-lg border border-paper-line-strong bg-paper/80 pl-10 pr-20 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-all focus:border-[#841B4D] focus:bg-paper focus:outline-none focus:ring-2 focus:ring-[#841B4D]/20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 rounded-md text-ink-faint hover:text-ink hover:bg-paper-line transition-colors cursor-pointer"
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

          {/* Select de Filtro por Status */}
          <div className="relative shrink-0">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-faint">
              <Filter className="h-3.5 w-3.5" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded-lg border border-paper-line-strong bg-paper/80 pl-9 pr-8 py-2.5 text-sm text-ink font-medium transition-all focus:border-[#841B4D] focus:outline-none focus:ring-2 focus:ring-[#841B4D]/20 cursor-pointer appearance-none"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="avaliacao">Avaliação</option>
              <option value="inativo">Inativo</option>
            </select>
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
            {searchQuery || statusFilter !== "todos"
              ? `Não foi possível encontrar nenhum paciente que corresponda aos filtros aplicados.`
              : "Nenhum paciente cadastrado até o momento."}
          </p>
          {(searchQuery || statusFilter !== "todos") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("todos");
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-paper-line-strong bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:border-[#841B4D] transition-all cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="w-full rounded-lg border border-paper-line-strong bg-paper/30 p-1">
            <FixedSizeList
              height={600}
              itemCount={paginatedRows.length}
              itemSize={72}
              width="100%"
              itemData={itemData}
            >
              {VirtualizedPatientRow}
            </FixedSizeList>
          </div>

          {/* Rodapé da Tabela: Paginação e Contador de Registros */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-paper-line-strong pt-4 px-1 text-xs text-ink-soft">
            <div>
              Exibindo <span className="font-semibold text-ink">{startRecord}</span> -{" "}
              <span className="font-semibold text-ink">{endRecord}</span> de{" "}
              <span className="font-semibold text-ink">{filteredRows.length}</span> pacientes
            </div>

            <div className="flex items-center gap-4">
              {/* Seletor de Itens por Página */}
              <div className="flex items-center gap-2">
                <span>Itens por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded border border-paper-line-strong bg-paper px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-[#841B4D] cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Botões de Navegação de Página */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded border border-paper-line-strong bg-paper text-ink hover:bg-paper-line transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-medium px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded border border-paper-line-strong bg-paper text-ink hover:bg-paper-line transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Próxima Página"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
