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
 * Renderiza cada ação como um link de texto (padrão text-xs text-chart / text-status-negative-text),
 * separadas por ml-3, no lugar de botões com ícone.
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
    <div className={`inline-flex items-center ${className}`}>
      {actions.map((action, index) => (
        <ActionButton
          key={action.item.key ?? action.label}
          item={action.item}
          fallbackTitle={action.fallbackTitle}
          label={action.label}
          isDanger={action.isDanger}
          isFirst={index === 0}
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
  isFirst = false,
}: {
  item?: QuickActionItem;
  fallbackTitle: string;
  label: string;
  isDanger?: boolean;
  isFirst?: boolean;
}) {
  const isEnabled = Boolean(item && !item.disabled && (item.href || item.onClick));
  const title = item?.title || fallbackTitle;

  const baseStyle = `text-xs ${isDanger ? "text-status-negative-text" : "text-chart"} ${isFirst ? "" : "ml-3"}`;

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
      className={`text-xs text-ink-faint opacity-50 cursor-not-allowed ${isFirst ? "" : "ml-3"}`}
    >
      {label}
    </span>
  );
}
