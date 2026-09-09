"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type QuickResponseChip = { id: string; shortcut: string; title: string; contentText: string };

export function QuickResponseChips({
  onSelect,
  disabled,
}: {
  onSelect: (contentText: string) => void;
  disabled?: boolean;
}) {
  const [responses, setResponses] = useState<QuickResponseChip[]>([]);

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
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (responses.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {responses.map((r) => (
        <button
          key={r.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(r.contentText)}
          className="rounded-full border border-paper-line-strong bg-paper px-3 py-1 text-xs font-medium text-ink-soft transition hover:bg-accent hover:text-white disabled:opacity-50"
          title={r.contentText}
        >
          {r.title}
        </button>
      ))}
    </div>
  );
}
