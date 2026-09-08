import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: EmptyStateAction;
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="my-auto flex flex-col items-center gap-1 py-4 text-center">
      <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-pink-50">
        <Icon className="h-4.5 w-4.5 text-pink-300" strokeWidth={1.75} />
      </div>
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <p className="max-w-[220px] text-[11px] text-slate-600">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[11px] font-semibold text-pink-700 hover:bg-pink-100"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
