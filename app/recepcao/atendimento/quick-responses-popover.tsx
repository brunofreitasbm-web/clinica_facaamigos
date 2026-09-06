"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type QuickResponseRow = { id: string; shortcut: string; title: string; contentText: string };

export function QuickResponsesPopover({
  filter,
  onSelect,
  onClose,
}: {
  filter: string;
  onSelect: (contentText: string) => void;
  onClose: () => void;
}) {
  const [responses, setResponses] = useState<QuickResponseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("quick_responses")
      .select("id, shortcut, title, content_text")
      .order("shortcut")
      .then(({ data }) => {
        if (cancelled) return;
        setResponses(
          (data ?? []).map((r) => ({ id: r.id, shortcut: r.shortcut, title: r.title, contentText: r.content_text })),
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedFilter = filter.replace(/^\//, "").toLowerCase();
  const filtered = responses.filter(
    (r) =>
      r.shortcut.replace(/^\//, "").toLowerCase().startsWith(normalizedFilter) ||
      r.title.toLowerCase().includes(normalizedFilter),
  );

  return (
    <div className="absolute bottom-full left-0 z-10 mb-2 w-80 max-h-64 overflow-y-auto rounded-md border border-paper-line-strong bg-white shadow-lg">
      {loading && <p className="p-3 text-xs text-ink-faint">Carregando…</p>}
      {!loading && filtered.length === 0 && (
        <p className="p-3 text-xs text-ink-faint">Nenhuma resposta rápida encontrada.</p>
      )}
      {filtered.map((r) => (
        <button
          key={r.id}
          type="button"
          className="flex w-full flex-col items-start gap-0.5 border-b border-paper-line px-3 py-2 text-left hover:bg-paper"
          onClick={() => {
            onSelect(r.contentText);
            onClose();
          }}
        >
          <span className="text-xs font-semibold text-chart">{r.shortcut}</span>
          <span className="text-xs text-ink-soft">{r.title}</span>
        </button>
      ))}
    </div>
  );
}
