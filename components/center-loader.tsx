/**
 * Indicador de carregamento centralizado, animado (anel em spin + logo pulsando).
 * Usado como overlay de navegação (ver route-progress-bar.tsx) e em telas
 * inteiras de carregamento (loading.tsx) — inclusive no login.
 */
import { Logo } from "@/components/brand/logo";

export function CenterLoader({
  label = "Carregando...",
  overlay = false,
}: {
  label?: string;
  overlay?: boolean;
}) {
  const content = (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <div className="relative flex items-center justify-center">
        <div className="center-loader-ring" aria-hidden="true" />
        <div className="absolute center-loader-dot">
          <Logo variant="simbolo" height={20} decorative />
        </div>
      </div>
      <span className="text-sm font-medium text-ink-soft">{label}</span>
    </div>
  );

  if (overlay) {
    return (
      <div className="center-loader-backdrop" aria-hidden={false}>
        {content}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[var(--color-bg)]">
      {content}
    </div>
  );
}
