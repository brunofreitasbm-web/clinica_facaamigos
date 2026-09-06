"use client";

import Link from "next/link";
import { DollarSign, User, Pencil, CalendarClock, Trash2 } from "lucide-react";

export interface QuickActionItem {
  key?: string;
  href?: string;
  onClick?: () => void;
  title: string;
  disabled?: boolean;
}

export interface QuickActionsBarProps {
  /** Configurações ou URLs para o ícone de Financeiro ($) */
  finance?: QuickActionItem;
  /** Configurações ou URLs para o ícone de Perfil / Ficha (👤) */
  profile?: QuickActionItem;
  /** Configurações ou URLs para o ícone de Edição Rápida (✏️) */
  edit?: QuickActionItem;
  /** Configurações ou URLs para o ícone de Agenda / Horários (📅) */
  schedule?: QuickActionItem;
  /** Configurações ou ação de Excluir / Remover (🗑️) */
  deleteAction?: QuickActionItem;
  className?: string;
}

/**
 * Componente de Barra de Ações Rápidas em linha para tabelas e cadastros.
 * Desenvolvido no padrão visual compacto com ícones finos de $ (Financeiro), 👤 (Perfil), ✏️ (Editar), 📅 (Agenda) e 🗑️ (Excluir).
 */
export function QuickActionsBar({
  finance,
  profile,
  edit,
  schedule,
  deleteAction,
  className = "",
}: QuickActionsBarProps) {
  return (
    <div className={`inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 ${className}`}>
      {/* 1. Financeiro ($) */}
      {finance && (
        <ActionButton
          item={finance}
          fallbackTitle="Financeiro / Repasse"
          icon={<DollarSign className="w-[18px] h-[18px] stroke-[1.75]" />}
        />
      )}

      {/* 2. Perfil / Ficha (👤) */}
      {profile && (
        <ActionButton
          item={profile}
          fallbackTitle="Ver Perfil / Ficha"
          icon={<User className="w-[18px] h-[18px] stroke-[1.75]" />}
        />
      )}

      {/* 3. Editar (✏️) */}
      {edit && (
        <ActionButton
          item={edit}
          fallbackTitle="Edição Rápida"
          icon={<Pencil className="w-[18px] h-[18px] stroke-[1.75]" />}
        />
      )}

      {/* 4. Agenda / Horários (📅) */}
      {schedule && (
        <ActionButton
          item={schedule}
          fallbackTitle="Agendamentos / Horários"
          icon={<CalendarClock className="w-[18px] h-[18px] stroke-[1.75]" />}
        />
      )}

      {/* 5. Excluir / Remover (🗑️) */}
      {deleteAction && (
        <ActionButton
          item={deleteAction}
          fallbackTitle="Excluir cadastro"
          isDanger
          icon={<Trash2 className="w-[18px] h-[18px] stroke-[1.75]" />}
        />
      )}
    </div>
  );
}

function ActionButton({
  item,
  fallbackTitle,
  icon,
  isDanger = false,
}: {
  item?: QuickActionItem;
  fallbackTitle: string;
  icon: React.ReactNode;
  isDanger?: boolean;
}) {
  const isEnabled = Boolean(item && !item.disabled && (item.href || item.onClick));
  const title = item?.title || fallbackTitle;

  const baseStyle = isDanger
    ? "p-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
    : "p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-slate-300 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/40 transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

  if (item?.href && !item.disabled) {
    return (
      <Link href={item.href} title={title} className={baseStyle}>
        {icon}
      </Link>
    );
  }

  if (item?.onClick && !item.disabled) {
    return (
      <button type="button" onClick={item.onClick} title={title} className={baseStyle}>
        {icon}
      </button>
    );
  }

  return (
    <span
      title={isEnabled ? title : `${title} (não disponível)`}
      className={`p-1.5 rounded-lg text-slate-300 dark:text-slate-600 cursor-not-allowed ${
        item?.disabled ? "opacity-40" : "opacity-60 hover:opacity-100 transition-opacity"
      }`}
    >
      {icon}
    </span>
  );
}
