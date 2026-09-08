import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

function EmptyStateActionButton({ action, variant }: { action: EmptyStateAction; variant: "primary" | "secondary" }) {
  const className =
    variant === "primary"
      ? "rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[11px] font-semibold text-pink-700 hover:bg-pink-100"
      : "rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50";

  if (action.href) {
    return (
      <a href={action.href} className={className}>
        {action.label}
      </a>
    );
  }
  return (
    <button onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

export function EmptyState({ title, description, icon: Icon = Inbox, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="my-auto flex flex-col items-center gap-1 py-4 text-center">
      <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-pink-50">
        <Icon className="h-4.5 w-4.5 text-pink-300" strokeWidth={1.75} />
      </div>
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      <p className="max-w-[220px] text-[11px] text-slate-600">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action && <EmptyStateActionButton action={action} variant="primary" />}
          {secondaryAction && <EmptyStateActionButton action={secondaryAction} variant="secondary" />}
        </div>
      )}
    </div>
  );
}
