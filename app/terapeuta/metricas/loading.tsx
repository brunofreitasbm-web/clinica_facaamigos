export default function TerapeutaMetricasLoading() {
  return (
    <main className="flex flex-1 flex-col">
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex flex-col gap-2.5 px-5 pb-4 pt-7 sm:px-10"
      >
        <div className="h-3.5 w-16 rounded skeleton-shimmer opacity-70" />
        <div className="h-7 w-48 rounded-lg skeleton-shimmer opacity-90" />
        <div className="h-3 w-56 rounded skeleton-shimmer opacity-60" />
      </header>

      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3 p-5 sm:p-10" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="card flex items-center justify-between gap-3 border border-[var(--color-neutral-200)]"
          >
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-40 rounded skeleton-shimmer" />
              <div className="h-3 w-52 rounded skeleton-shimmer" />
            </div>
            <div className="h-6 w-12 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    </main>
  );
}
