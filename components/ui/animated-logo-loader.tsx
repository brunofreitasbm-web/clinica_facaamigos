import { Logo } from "@/components/brand/logo";

export function AnimatedLogoLoader({ message = "Carregando..." }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg bg-opacity-80 backdrop-blur-sm"
    >
      <div className="animate-pulse">
        <Logo variant="simbolo" height={64} />
      </div>
      {message && (
        <span className="font-mono text-xs font-medium text-ink-soft uppercase tracking-widest">
          {message}
        </span>
      )}
      <span className="sr-only">Carregando sistema...</span>
    </div>
  );
}
