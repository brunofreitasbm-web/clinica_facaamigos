"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function DraftModalShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Conferir e cadastrar — ${title}`}
        className="flex h-[94vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-lg border border-paper-line-strong bg-paper shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-paper-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-bold text-ink">{title}</h2>
            <p className="m-0 mt-1 text-sm text-ink-soft">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="border-0 bg-transparent text-2xl leading-none text-ink-soft"
            aria-label="Fechar"
          >
            ×
          </button>
        </header>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
