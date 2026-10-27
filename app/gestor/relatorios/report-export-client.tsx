"use client";

import { useState, useEffect, useTransition, useId } from "react";
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  Search,
  CheckSquare,
  Square,
  Users,
  Activity,
  CreditCard,
  Briefcase,
  FileText,
  UserCheck,
  Receipt,
  RotateCw,
  Sparkles,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  REPORT_CONFIGS,
  type ReportType,
  type ReportFilterState,
  type FilterMetadata,
} from "./types";
import { generateReportData } from "./actions";

interface ReportExportClientProps {
  metadata: FilterMetadata;
}

export function ReportExportClient({ metadata }: ReportExportClientProps) {
  const [activeReport, setActiveReport] = useState<ReportType>("clientes");

  // Período padrão: Mês atual
  const [periodPreset, setPeriodPreset] = useState<
    "30d" | "current_month" | "previous_month" | "90d" | "year" | "all" | "custom"
  >("current_month");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const [status, setStatus] = useState("todos");
  const [insurerId, setInsurerId] = useState("todos");
  const [therapistId, setTherapistId] = useState("todos");
  const [discipline, setDiscipline] = useState("todas");
  const [modality, setModality] = useState("todas");
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  // Preview state
  const [totalCount, setTotalCount] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isExporting, startExportTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExportCount, setLastExportCount] = useState<number | null>(null);

  const filterId = useId();

  // Atualiza colunas padrão ao trocar de relatório
  useEffect(() => {
    const config = REPORT_CONFIGS[activeReport];
    const defaultCols = config.columns
      .filter((c) => c.defaultSelected)
      .map((c) => c.key);
    setSelectedColumns(defaultCols);
    setStatus("todos");
    setInsurerId("todos");
    setTherapistId("todos");
    setDiscipline("todas");
    setModality("todas");
    setSearchTerm("");
    setLastExportCount(null);
  }, [activeReport]);

  // Aplica datas conforme o preset selecionado
  useEffect(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    if (periodPreset === "current_month") {
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      setDateStart(`${year}-${pad(month + 1)}-01`);
      setDateEnd(`${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`);
    } else if (periodPreset === "previous_month") {
      const year = now.getFullYear();
      const month = now.getMonth() - 1;
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      setDateStart(`${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-01`);
      setDateEnd(`${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(lastDay.getDate())}`);
    } else if (periodPreset === "30d") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setDateStart(`${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`);
      setDateEnd(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    } else if (periodPreset === "90d") {
      const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      setDateStart(`${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`);
      setDateEnd(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    } else if (periodPreset === "year") {
      const year = now.getFullYear();
      setDateStart(`${year}-01-01`);
      setDateEnd(`${year}-12-31`);
    } else if (periodPreset === "all") {
      setDateStart("");
      setDateEnd("");
    }
  }, [periodPreset]);

  // Recarrega o preview sempre que filtros ou colunas mudam
  useEffect(() => {
    let isCancelled = false;

    async function loadPreview() {
      setPreviewLoading(true);
      setExportError(null);

      const filter: ReportFilterState = {
        reportType: activeReport,
        dateStart: dateStart || undefined,
        dateEnd: dateEnd || undefined,
        periodPreset,
        status: status !== "todos" ? status : undefined,
        insurerId: insurerId !== "todos" ? insurerId : undefined,
        therapistId: therapistId !== "todos" ? therapistId : undefined,
        discipline: discipline !== "todas" ? discipline : undefined,
        modality: modality !== "todas" ? modality : undefined,
        searchTerm: searchTerm.trim() || undefined,
        selectedColumns,
      };

      const result = await generateReportData(filter, false);
      if (!isCancelled) {
        if (result.success) {
          setTotalCount(result.count);
          setHeaders(result.headers);
          setSampleRows(result.sampleRows);
        } else {
          setExportError(result.error ?? "Erro ao carregar prévia");
        }
        setPreviewLoading(false);
      }
    }

    const timer = setTimeout(() => {
      loadPreview();
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    activeReport,
    dateStart,
    dateEnd,
    periodPreset,
    status,
    insurerId,
    therapistId,
    discipline,
    modality,
    searchTerm,
    selectedColumns,
  ]);

  function handleSelectAllColumns() {
    const all = REPORT_CONFIGS[activeReport].columns.map((c) => c.key);
    setSelectedColumns(all);
  }

  function handleClearAllColumns() {
    // Mantém pelo menos a primeira coluna obrigatória
    const first = REPORT_CONFIGS[activeReport].columns[0]?.key;
    setSelectedColumns(first ? [first] : []);
  }

  function toggleColumn(key: string) {
    if (selectedColumns.includes(key)) {
      if (selectedColumns.length === 1) return; // Evita deixar sem nenhuma coluna
      setSelectedColumns(selectedColumns.filter((k) => k !== key));
    } else {
      setSelectedColumns([...selectedColumns, key]);
    }
  }

  function handleExportCsv() {
    setExportError(null);
    startExportTransition(async () => {
      const filter: ReportFilterState = {
        reportType: activeReport,
        dateStart: dateStart || undefined,
        dateEnd: dateEnd || undefined,
        periodPreset,
        status: status !== "todos" ? status : undefined,
        insurerId: insurerId !== "todos" ? insurerId : undefined,
        therapistId: therapistId !== "todos" ? therapistId : undefined,
        discipline: discipline !== "todas" ? discipline : undefined,
        modality: modality !== "todas" ? modality : undefined,
        searchTerm: searchTerm.trim() || undefined,
        selectedColumns,
      };

      const res = await generateReportData(filter, true);
      if (!res.success || !res.csv || !res.filename) {
        setExportError(res.error ?? "Falha na exportação do relatório.");
        return;
      }

      // Download do CSV com codificação UTF-8
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setLastExportCount(res.count);
    });
  }

  const currentConfig = REPORT_CONFIGS[activeReport];

  // Configurações dos cards de categorias
  const CATEGORIES: {
    id: ReportType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    desc: string;
  }[] = [
    {
      id: "clientes",
      label: "Clientes & Pacientes",
      icon: Users,
      desc: "Prontuários, cadastros, dados de contato e diagnósticos",
    },
    {
      id: "terapias",
      label: "Terapias & Sessões",
      icon: Activity,
      desc: "Histórico de atendimentos, faltas, presenças e salas",
    },
    {
      id: "planos",
      label: "Planos & Convênios",
      icon: CreditCard,
      desc: "Operadoras, registros ANS e carteirinhas de pacientes",
    },
    {
      id: "contratos",
      label: "Contratos de Pacientes",
      icon: Briefcase,
      desc: "Mensalidades, vencimentos e modalidades contratadas",
    },
    {
      id: "pts",
      label: "Planos Terapêuticos (PTS)",
      icon: FileText,
      desc: "Metas, versões de planos, aprovações e revisões",
    },
    {
      id: "profissionais",
      label: "Corpo Clínico & Equipe",
      icon: UserCheck,
      desc: "Profissionais, conselhos de classe, RT e especialidades",
    },
    {
      id: "faturamento",
      label: "Faturamento & Produção",
      icon: Receipt,
      desc: "Lotes faturáveis, guias e códigos TUSS por competência",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. SELEÇÃO DA CATEGORIA DO RELATÓRIO */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            1. Escolha a Categoria do Relatório
          </span>
          <span className="text-xs text-ink-soft">
            {CATEGORIES.length} módulos disponíveis para exportação
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {CATEGORIES.map((cat) => {
            const isSelected = activeReport === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveReport(cat.id)}
                className={`flex flex-col text-left p-3.5 rounded-lg border transition-all ${
                  isSelected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-ink shadow-sm"
                    : "border-border bg-surface hover:border-ink-faint hover:bg-surface-elevated text-ink-soft"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-md ${
                      isSelected
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-surface-elevated text-ink-soft"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                  )}
                </div>
                <div
                  className={`text-sm font-semibold leading-tight mb-1 ${
                    isSelected ? "text-ink font-bold" : "text-ink"
                  }`}
                >
                  {cat.label}
                </div>
                <div className="text-[11px] leading-snug line-clamp-2 text-ink-faint">
                  {cat.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. FILTRAGEM PRÉ-EMISSÃO */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-base font-semibold text-ink">
              2. Filtrar Dados de {currentConfig.title}
            </h2>
          </div>
          <span className="text-xs text-ink-soft">
            Os filtros são aplicados em tempo real na prévia e no arquivo final
          </span>
        </div>

        {/* Grade de Controles de Filtro */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Preset de Período */}
          <div>
            <label
              htmlFor={`${filterId}-period`}
              className="block text-xs font-medium text-ink-soft mb-1"
            >
              Período de Referência
            </label>
            <select
              id={`${filterId}-period`}
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as typeof periodPreset)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="current_month">Mês Atual</option>
              <option value="previous_month">Mês Anterior</option>
              <option value="30d">Últimos 30 Dias</option>
              <option value="90d">Últimos 90 Dias</option>
              <option value="year">Ano Corrente</option>
              <option value="all">Todo o Histórico</option>
              <option value="custom">Personalizado (Datas)</option>
            </select>
          </div>

          {/* Data Início & Fim */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label
                htmlFor={`${filterId}-start`}
                className="block text-xs font-medium text-ink-soft mb-1"
              >
                Data Inicial
              </label>
              <input
                type="date"
                id={`${filterId}-start`}
                value={dateStart}
                onChange={(e) => {
                  setDateStart(e.target.value);
                  setPeriodPreset("custom");
                }}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor={`${filterId}-end`}
                className="block text-xs font-medium text-ink-soft mb-1"
              >
                Data Final
              </label>
              <input
                type="date"
                id={`${filterId}-end`}
                value={dateEnd}
                onChange={(e) => {
                  setDateEnd(e.target.value);
                  setPeriodPreset("custom");
                }}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
          </div>

          {/* Status Contextual */}
          <div>
            <label
              htmlFor={`${filterId}-status`}
              className="block text-xs font-medium text-ink-soft mb-1"
            >
              Status
            </label>
            <select
              id={`${filterId}-status`}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="todos">Todos os status</option>
              {activeReport === "clientes" &&
                metadata.patientStatuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              {activeReport === "terapias" &&
                metadata.appointmentStatuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              {activeReport === "contratos" &&
                metadata.contractStatuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              {activeReport === "pts" &&
                metadata.ptsStatuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              {activeReport === "profissionais" && (
                <>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </>
              )}
            </select>
          </div>

          {/* Filtro de Convênio (quando aplicável) */}
          {(activeReport === "clientes" ||
            activeReport === "planos" ||
            activeReport === "faturamento") && (
            <div>
              <label
                htmlFor={`${filterId}-insurer`}
                className="block text-xs font-medium text-ink-soft mb-1"
              >
                Convênio / Plano
              </label>
              <select
                id={`${filterId}-insurer`}
                value={insurerId}
                onChange={(e) => setInsurerId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-[var(--color-accent)] focus:outline-none"
              >
                <option value="todos">Todos os convênios</option>
                <option value="particular">Apenas Particular</option>
                {metadata.insurers.map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro de Terapeuta (quando aplicável) */}
          {activeReport === "terapias" && (
            <div>
              <label
                htmlFor={`${filterId}-therapist`}
                className="block text-xs font-medium text-ink-soft mb-1"
              >
                Profissional / Terapeuta
              </label>
              <select
                id={`${filterId}-therapist`}
                value={therapistId}
                onChange={(e) => setTherapistId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-[var(--color-accent)] focus:outline-none"
              >
                <option value="todos">Todos os profissionais</option>
                {metadata.therapists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} {t.discipline ? `(${t.discipline})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro de Disciplina/Especialidade (quando aplicável) */}
          {(activeReport === "terapias" || activeReport === "profissionais") && (
            <div>
              <label
                htmlFor={`${filterId}-discipline`}
                className="block text-xs font-medium text-ink-soft mb-1"
              >
                Especialidade / Disciplina
              </label>
              <select
                id={`${filterId}-discipline`}
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-[var(--color-accent)] focus:outline-none"
              >
                <option value="todas">Todas as disciplinas</option>
                {metadata.disciplines.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro de Modalidade (quando aplicável) */}
          {activeReport === "terapias" && (
            <div>
              <label
                htmlFor={`${filterId}-modality`}
                className="block text-xs font-medium text-ink-soft mb-1"
              >
                Modalidade
              </label>
              <select
                id={`${filterId}-modality`}
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-[var(--color-accent)] focus:outline-none"
              >
                <option value="todas">Todas as modalidades</option>
                <option value="individual">Individual</option>
                <option value="grupo">Grupo</option>
              </select>
            </div>
          )}

          {/* Busca textual livre */}
          <div className="sm:col-span-2">
            <label
              htmlFor={`${filterId}-search`}
              className="block text-xs font-medium text-ink-soft mb-1"
            >
              Busca Rápida
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-faint" />
              <input
                type="text"
                id={`${filterId}-search`}
                placeholder="Filtrar por nome de paciente, terapeuta, CPF, carteirinha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. SELEÇÃO DE COLUNAS PERSONALIZADAS */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-semibold text-ink">
                3. Escolha as Colunas para o CSV
              </h3>
            </div>
            <p className="text-xs text-ink-soft mt-0.5">
              {selectedColumns.length} de {currentConfig.columns.length} colunas selecionadas para emissão
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllColumns}
              className="rounded px-2.5 py-1 text-xs font-medium border border-border hover:bg-surface-elevated text-ink"
            >
              Marcar Todas
            </button>
            <button
              type="button"
              onClick={handleClearAllColumns}
              className="rounded px-2.5 py-1 text-xs font-medium border border-border hover:bg-surface-elevated text-ink-soft"
            >
              Limpar Seleção
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {currentConfig.columns.map((col) => {
            const isChecked = selectedColumns.includes(col.key);
            return (
              <label
                key={col.key}
                className={`flex items-center gap-2 rounded-md p-2 text-xs cursor-pointer select-none border transition-colors ${
                  isChecked
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-ink font-medium"
                    : "border-border bg-surface hover:bg-surface-elevated text-ink-soft"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleColumn(col.key)}
                  className="rounded border-border text-[var(--color-accent)] focus:ring-0"
                />
                <span className="truncate" title={col.label}>
                  {col.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 4. PRÉ-VISUALIZAÇÃO DINÂMICA & BOTÃO DE EXPORTAR */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-ink">
                  4. Pré-visualização dos Dados Filtrados
                </h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                  {totalCount} {totalCount === 1 ? "registro encontrado" : "registros encontrados"}
                </span>
                {previewLoading && (
                  <span className="flex items-center gap-1 text-xs text-ink-faint">
                    <RotateCw className="h-3 w-3 animate-spin" /> Atualizando...
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft">
                Mostrando as primeiras linhas que serão geradas no arquivo CSV com as colunas ativas.
              </p>
            </div>
          </div>

          {/* Botão de Ação Principal: Exportar CSV */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isExporting || totalCount === 0 || selectedColumns.length === 0}
              onClick={handleExportCsv}
              className="btn btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className={`h-4 w-4 ${isExporting ? "animate-bounce" : ""}`} />
              {isExporting ? "Gerando CSV..." : `Exportar ${totalCount} Registros em CSV`}
            </button>
          </div>
        </div>

        {/* Feedback de sucesso de exportação */}
        {lastExportCount != null && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>
              Arquivo CSV com <strong>{lastExportCount} registros</strong> gerado e baixado com sucesso!
              Codificação UTF-8 com BOM (compatível nativamente com Microsoft Excel PT-BR).
            </span>
          </div>
        )}

        {/* Alerta de erro */}
        {exportError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span>{exportError}</span>
          </div>
        )}

        {/* Tabela de Preview */}
        {totalCount === 0 && !previewLoading ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
            <Filter className="h-8 w-8 text-ink-faint mb-2" />
            <h4 className="text-sm font-semibold text-ink">Nenhum registro encontrado</h4>
            <p className="text-xs text-ink-soft max-w-sm mt-1">
              Ajuste o período, limpe a busca ou mude os filtros para visualizar os dados a serem exportados.
            </p>
          </div>
        ) : (
          <div className="relative overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-ink-soft border-b border-border">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-ink-faint w-12 text-center">#</th>
                  {headers.map((h, i) => (
                    <th key={i} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {sampleRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="py-2.5 px-3 text-center text-ink-faint font-mono">
                      {rowIdx + 1}
                    </td>
                    {row.map((val, colIdx) => (
                      <td key={colIdx} className="py-2.5 px-3 whitespace-nowrap text-ink">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {totalCount > sampleRows.length && (
              <div className="border-t border-border bg-surface-elevated px-4 py-2 text-center text-xs text-ink-soft">
                Mostrando prévia das primeiras {sampleRows.length} linhas. Ao clicar em{" "}
                <strong>&quot;Exportar CSV&quot;</strong>, todos os <strong>{totalCount} registros</strong> filtrados serão exportados.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
