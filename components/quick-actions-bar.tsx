"use client";

import Link from "next/link";

export interface QuickActionItem {
  key?: string;
  href?: string;
  onClick?: () => void;
  title: string;
  disabled?: boolean;
}

export interface QuickActionsBarProps {
  /** Configurações ou URLs para a ação de Financeiro */
  finance?: QuickActionItem;
  /** Configurações ou URLs para a ação de Perfil / Ficha */
  profile?: QuickActionItem;
  /** Configurações ou URLs para a ação de Edição Rápida */
  edit?: QuickActionItem;
  /** Configurações ou URLs para a ação de Agenda / Horários */
  schedule?: QuickActionItem;
  /** Configurações ou ação de Excluir / Remover */
  deleteAction?: QuickActionItem;
  className?: string;
}

/**
 * Componente de Barra de Ações Rápidas em linha para tabelas e cadastros.
 * Aprimorado com as Leis de UX:
 * - Fitts's Law: área de toque confortável (min-h-[36px], padding adequado) evitando erros de clique.
 * - Law of Proximity: agrupamento visual claro das ações da linha com gap consistente.
 * - Doherty Threshold: feedback tátil com transição instantânea e active state.
 * - Von Restorff Effect: diferenciação visual para ações perigosas (exclusão).
 */
export function QuickActionsBar({
  finance,
  profile,
  edit,
  schedule,
  deleteAction,
  className = "",
}: QuickActionsBarProps) {
  const actions = [
    finance && { item: finance, fallbackTitle: "Financeiro / Repasse", label: "Financeiro" },
    profile && { item: profile, fallbackTitle: "Ver Perfil / Ficha", label: "Perfil" },
    edit && { item: edit, fallbackTitle: "Edição Rápida", label: "Editar" },
    schedule && { item: schedule, fallbackTitle: "Agendamentos / Horários", label: "Agenda" },
    deleteAction && { item: deleteAction, fallbackTitle: "Excluir cadastro", label: "Excluir", isDanger: true },
  ].filter((a): a is { item: QuickActionItem; fallbackTitle: string; label: string; isDanger?: boolean } => Boolean(a));

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {actions.map((action) => (
        <ActionButton
          key={action.item.key ?? action.label}
          item={action.item}
          fallbackTitle={action.fallbackTitle}
          label={action.label}
          isDanger={action.isDanger}
        />
      ))}
    </div>
  );
}

function ActionButton({
  item,
  fallbackTitle,
  label,
  isDanger = false,
}: {
  item?: QuickActionItem;
  fallbackTitle: string;
  label: string;
  isDanger?: boolean;
}) {
  const isEnabled = Boolean(item && !item.disabled && (item.href || item.onClick));
  const title = item?.title || fallbackTitle;

  const baseStyle = `inline-flex items-center justify-center min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-all duration-150 active:scale-95 no-underline ${
    isDanger
      ? "text-status-negative-text hover:bg-status-negative-soft"
      : "text-chart hover:bg-chart-soft/40"
  }`;

  if (item?.href && !item.disabled) {
    return (
      <Link href={item.href} title={title} className={baseStyle}>
        {label}
      </Link>
    );
  }

  if (item?.onClick && !item.disabled) {
    return (
      <button type="button" onClick={item.onClick} title={title} className={baseStyle}>
        {label}
      </button>
    );
  }

  return (
    <span
      title={isEnabled ? title : `${title} (não disponível)`}
      className="inline-flex items-center justify-center min-h-[36px] px-2 py-1 text-xs text-ink-faint opacity-50 cursor-not-allowed"
    >
      {label}
    </span>
  );
}
