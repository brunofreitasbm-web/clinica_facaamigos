"use client";

import React from "react";
import {
  Clock,
  CheckCircle2,
  UserCheck,
  XCircle,
  AlertCircle,
  PlayCircle,
  User,
  Sparkles,
  Calendar,
  CheckSquare,
} from "lucide-react";

/**
 * Formata nome completo de paciente para Title Case limpo (ex: "MARIA DA SILVA" -> "Maria da Silva")
 */
export function formatPatientName(name: string): string {
  if (!name) return "";
  const lowercaseWords = ["da", "de", "do", "das", "dos", "e"];
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && lowercaseWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Valida se um nome de paciente contém padrões de dados brutos/timestamps do banco (ex: "Child_1788517902660", "P(Paciente Fictício")
 */
export function isIncompleteOrMockName(name: string): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  return (
    /^Child_\d+/i.test(trimmed) ||
    /^P\(.*?\)?$/i.test(trimmed) ||
    /^(Child|Patient|Paciente|User|Test)_\d+/i.test(trimmed) ||
    /^P\(/i.test(trimmed)
  );
}

/**
 * Converte strings brutas da API/Banco (ex: "avaliacao") para formato legível e acentuado ("Avaliação")
 */
export function formatStatus(status: string): string {
  if (!status) return "Status Desconhecido";
  const normalizedKey = status.toLowerCase().trim();

  const statusMap: Record<string, string> = {
    avaliacao: "Avaliação",
    avaliacao_agendada: "Avaliação Agendada",
    aguardando_vaga: "Aguardando Vaga",
    em_triagem: "Em Triagem",
    desistente: "Desistente",
    cancelado: "Cancelado",
    ativo: "Ativo",
    inativo: "Inativo",
    pendente: "Pendente",
    interessado: "Interessado",
  };

  if (statusMap[normalizedKey]) {
    return statusMap[normalizedKey];
  }

  return normalizedKey
    .replace(/_/g, " ")
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Retorna as iniciais do nome para avatar visual de escaneabilidade
 */
export function getPatientInitials(name: string): string {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

/**
 * Configuração de cores, rótulos e ícones semânticos para cada status de atendimento/paciente
 */
export type StatusType =
  | "agendada"
  | "confirmada"
  | "na_recepcao"
  | "aguardando"
  | "em_atendimento"
  | "realizada"
  | "concluido"
  | "falta_familia"
  | "cancelada_familia"
  | "cancelada_terapeuta"
  | "cancelada_clinica"
  | "remarcada"
  | "ativo"
  | "inativo"
  | "novo"
  | string;

interface StatusConfig {
  label: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
  pulse?: boolean;
}

const STATUS_CONFIG_MAP: Record<string, StatusConfig> = {
  agendada: {
    label: "A Confirmar",
    badgeClass:
      "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700",
    icon: Calendar,
  },
  confirmada: {
    label: "Confirmada",
    badgeClass:
      "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/80 dark:text-sky-200 dark:border-sky-700",
    icon: CheckCircle2,
  },
  na_recepcao: {
    label: "Na Recepção",
    badgeClass:
      "bg-amber-200 text-amber-950 border-amber-400 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-600 font-bold",
    icon: Clock,
    pulse: true,
  },
  aguardando: {
    label: "Aguardando",
    badgeClass:
      "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700",
    icon: Clock,
  },
  em_atendimento: {
    label: "Em Atendimento",
    badgeClass:
      "bg-emerald-100 text-emerald-950 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700 font-bold",
    icon: PlayCircle,
    pulse: true,
  },
  realizada: {
    label: "Realizada",
    badgeClass:
      "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-700",
    icon: CheckSquare,
  },
  concluido: {
    label: "Concluído",
    badgeClass:
      "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-700",
    icon: CheckSquare,
  },
  falta_familia: {
    label: "Falta Família",
    badgeClass:
      "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700 font-semibold",
    icon: XCircle,
  },
  cancelada_familia: {
    label: "Cancelada (Família)",
    badgeClass:
      "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    icon: XCircle,
  },
  cancelada_terapeuta: {
    label: "Cancelada (Terapeuta)",
    badgeClass:
      "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-700",
    icon: AlertCircle,
  },
  cancelada_clinica: {
    label: "Cancelada (Clínica)",
    badgeClass:
      "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
    icon: XCircle,
  },
  remarcada: {
    label: "Remarcada",
    badgeClass:
      "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-700",
    icon: Clock,
  },
  ativo: {
    label: "Ativo",
    badgeClass:
      "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700",
    icon: UserCheck,
  },
  inativo: {
    label: "Inativo",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    icon: User,
  },
  novo: {
    label: "Novo / Avaliação",
    badgeClass:
      "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-700 font-medium",
    icon: Sparkles,
  },
  avaliacao: {
    label: "Avaliação",
    badgeClass:
      "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/90 dark:text-amber-100 dark:border-amber-700 font-semibold",
    icon: Sparkles,
  },
};

/**
 * Componente de Badge de Status com alto contraste visual e ícone semântico
 */
export function PatientStatusBadge({
  status,
  customLabel,
  size = "md",
}: {
  status: StatusType;
  customLabel?: string;
  size?: "sm" | "md" | "lg";
}) {
  const normalizedKey = String(status).toLowerCase().trim();
  const config = STATUS_CONFIG_MAP[normalizedKey] || {
    label: customLabel || formatStatus(status),
    badgeClass:
      "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
    icon: AlertCircle,
  };

  const displayLabel = customLabel || config.label || formatStatus(status);
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  }[size];

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium shadow-xs transition-all ${config.badgeClass} ${sizeClasses}`}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      <Icon className={`${iconSizes} shrink-0 opacity-90`} />
      <span className="whitespace-nowrap tracking-tight">{displayLabel}</span>
    </span>
  );
}

/**
 * Componente de exibição formatada do Nome do Paciente com avatar e detalhes visuais
 */
export function PatientFormattedDisplay({
  name,
  subtitle,
  tags,
  isEvaluation,
  showAvatar = true,
  size = "md",
  className = "",
}: {
  name: string;
  subtitle?: React.ReactNode;
  tags?: string[];
  isEvaluation?: boolean;
  showAvatar?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const isIncomplete = isIncompleteOrMockName(name);
  const formattedName = formatPatientName(name);
  const initials = getPatientInitials(name);

  const titleSizes = {
    sm: "text-xs font-semibold",
    md: "text-sm font-bold tracking-tight",
    lg: "text-base font-bold tracking-tight",
  }[size];

  const avatarSizes = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  }[size];

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      {showAvatar && (
        <div
          className={`grid shrink-0 place-items-center rounded-full font-bold shadow-xs select-none ${avatarSizes}`}
          style={{
            background: "var(--color-accent-2, #e0f2fe)",
            color: "var(--color-accent, #0369a1)",
          }}
          title={formattedName}
        >
          {initials}
        </div>
      )}
      <div className="flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`truncate text-ink hover:text-chart transition-colors ${titleSizes}`}>
            {formattedName}
          </span>
          {isIncomplete && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
              <AlertCircle className="h-2.5 w-2.5" />
              Cadastro Incompleto
            </span>
          )}
          {isEvaluation && (
            <span className="inline-flex items-center gap-0.5 rounded bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <Sparkles className="h-2.5 w-2.5" />
              Avaliação
            </span>
          )}
          {tags &&
            tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-paper-line/80 px-1.5 py-0.5 text-[10px] font-medium text-ink-soft border border-paper-line-strong"
              >
                {tag}
              </span>
            ))}
        </div>
        {subtitle && <div className="truncate text-ink-soft">{subtitle}</div>}
      </div>
    </div>
  );
}
