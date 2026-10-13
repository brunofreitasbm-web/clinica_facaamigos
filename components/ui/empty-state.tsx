import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import Link from "next/link";

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

/**
 * EmptyState aprimorado pelas Leis de UX:
 * - Fitts's Law: botões com alvo de toque mínimo de 44px e área de clique espaçosa.
 * - Von Restorff Effect: ação primária ganha destaque visual imediato sobre a secundária.
 * - Paradox of the Active User: caminho direto para o próximo passo sem manuais.
 * - Doherty Threshold: feedback tátil com transição rápida e escala sutil.
 */
function EmptyStateActionButton({ action, variant }: { action: EmptyStateAction; variant: "primary" | "secondary" }) {
  const className =
    variant === "primary"
      ? "inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all duration-150 hover:bg-accent-600 hover:shadow-md active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      : "inline-flex min-h-[44px] items-center justify-center rounded-full border border-neutral-300 bg-surface px-5 py-2.5 text-xs font-bold text-neutral-700 shadow-2xs transition-all duration-150 hover:bg-neutral-100 hover:text-neutral-900 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

export function EmptyState({ title, description, icon: Icon = Inbox, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="my-auto flex flex-col items-center gap-2 py-8 text-center px-4">
      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-accent-100/70 text-accent ring-8 ring-accent-100/30">
        <Icon className="h-7 w-7" strokeWidth={1.8} />
      </div>
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="max-w-[320px] text-xs leading-relaxed text-ink-muted">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          {action && <EmptyStateActionButton action={action} variant="primary" />}
          {secondaryAction && <EmptyStateActionButton action={secondaryAction} variant="secondary" />}
        </div>
      )}
    </div>
  );
}
