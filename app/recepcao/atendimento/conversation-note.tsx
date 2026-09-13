"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { saveConversationNote } from "./actions";

/**
 * Nota interna da conversa (migration 20260913110000) — recado entre recepção
 * e supervisão, nunca enviado ao contato. Se a coluna ainda não existir no
 * banco, o bloco simplesmente não aparece em vez de quebrar o painel.
 */
export function ConversationNote({ conversationId }: { conversationId: string }) {
  const [available, setAvailable] = useState(false);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("twilio_conversations")
      .select("internal_note, internal_note_updated_at")
      .eq("id", conversationId)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setAvailable(false);
          return;
        }
        setAvailable(true);
        setNote(data?.internal_note ?? "");
        setSavedNote(data?.internal_note ?? "");
        setUpdatedAt(data?.internal_note_updated_at ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  if (!available) return null;

  const dirty = note.trim() !== savedNote.trim();

  return (
    <div>
      <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-2">
        Nota interna
      </h6>
      <textarea
        className="input w-full text-sm"
        rows={3}
        placeholder="Recado para a equipe (não é enviado ao contato)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint">
          {error
            ? `⚠️ ${error}`
            : updatedAt
              ? `Atualizada em ${new Date(updatedAt).toLocaleString("pt-BR", {
                  timeZone: CLINIC_TIMEZONE,
                  dateStyle: "short",
                  timeStyle: "short",
                })}`
              : ""}
        </span>
        {dirty && (
          <button
            type="button"
            disabled={isPending}
            className="btn btn-secondary text-xs"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await saveConversationNote(conversationId, note);
                if (!result.success) {
                  setError(result.error);
                  return;
                }
                setSavedNote(note);
                setUpdatedAt(new Date().toISOString());
              });
            }}
          >
            {isPending ? "Salvando…" : "Salvar nota"}
          </button>
        )}
      </div>
    </div>
  );
}
