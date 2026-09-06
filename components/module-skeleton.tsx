import React from "react";

export function ModuleSkeleton({
  title = "Carregando...",
  subtitle = "Buscando dados atualizados do sistema",
  showCards = true,
}: {
  title?: string;
  subtitle?: string;
  showCards?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Top Header Placeholder if needed */}
      <main className="flex-1 p-8 space-y-6 max-w-[1400px] w-full mx-auto animate-fade-in">
        {/* Title Block */}
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-lg skeleton-shimmer" />
          <div className="h-4 w-96 rounded-md skeleton-shimmer" />
        </div>

        {/* Stat Cards */}
        {showCards && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-[var(--color-surface)] shadow-sm border border-[var(--color-neutral-200)] space-y-3"
              >
                <div className="flex justify-between items-center">
                  <div className="h-4 w-24 rounded skeleton-shimmer" />
                  <div className="h-8 w-8 rounded-full skeleton-shimmer" />
                </div>
                <div className="h-7 w-20 rounded skeleton-shimmer" />
                <div className="h-3 w-32 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
        )}

        {/* Main Content Card / Table Skeleton */}
        <div className="p-6 rounded-2xl bg-[var(--color-surface)] shadow-sm border border-[var(--color-neutral-200)] space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-[var(--color-neutral-200)]">
            <div className="h-6 w-48 rounded skeleton-shimmer" />
            <div className="h-9 w-32 rounded-full skeleton-shimmer" />
          </div>

          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex items-center gap-4 py-2 border-b border-[var(--color-neutral-100)]">
                <div className="h-4 w-12 rounded skeleton-shimmer" />
                <div className="h-4 flex-1 rounded skeleton-shimmer" />
                <div className="h-4 w-28 rounded skeleton-shimmer" />
                <div className="h-6 w-20 rounded-full skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
