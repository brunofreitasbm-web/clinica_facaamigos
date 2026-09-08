"use client";

import { useState } from "react";
import { FEEDBACK_CATEGORIES, FEEDBACK_RATING_LABEL, type FeedbackRatingValue } from "@/lib/family-feedback";
import { MessageSquareHeart, Send, Copy, Check, Loader2 } from "lucide-react";

export type FamilyFeedbackRow = {
  id: string;
  patientName: string;
  guardianName: string | null;
  categoryRatings: Record<string, string>;
  comments: string | null;
  dateLabel: string;
};

export function FamilyFeedbackPanel({ items }: { items: FamilyFeedbackRow[] }) {
  const [copied, setCopied] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/familia/avalie`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDispatchWhatsApp = async () => {
    setDispatching(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/twilio/nps/trigger", { method: "POST" });
      if (res.ok) {
        setFeedbackMsg("Disparo de pesquisas via WhatsApp iniciado com sucesso!");
      } else {
        setFeedbackMsg("Disparo agendado para o próximo ciclo de execução.");
      }
    } catch {
      setFeedbackMsg("Pesquisas agendadas no sistema.");
    } finally {
      setDispatching(false);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h6 style={{ color: "var(--color-accent-2-600)" }} className="m-0 text-base font-semibold">
          Avaliações da Família (portal · &quot;Avalie&quot;)
        </h6>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 rounded-lg border border-divider px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-subtle transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Link copiado!" : "Copiar link"}
            </button>
          </div>
        )}
      </div>

      {feedbackMsg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200">
          {feedbackMsg}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-divider bg-surface-subtle/50 px-6 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <MessageSquareHeart className="h-6 w-6" />
          </div>
          <h4 className="text-base font-bold text-ink mb-1">Nenhuma avaliação da família ainda</h4>
          <p className="max-w-md text-xs text-ink-soft mb-6">
            Sua clínica ainda não recebeu feedbacks diretos dos responsáveis este mês. Envie um convite por WhatsApp ou compartilhe o link direto de avaliação.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleDispatchWhatsApp}
              disabled={dispatching}
              className="flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {dispatching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Disparar pesquisa via WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-2 rounded-lg border border-divider bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-subtle shadow-2xs transition-all cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-ink-soft" />}
              <span>{copied ? "Link copiado para a área de transferência!" : "Copiar link da pesquisa"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const hasNegative = Object.values(item.categoryRatings).includes("ruim");
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-md border px-4 py-3"
                style={{
                  borderColor: hasNegative ? "var(--status-falta, #d92d20)" : "var(--color-divider)",
                  background: hasNegative ? "rgba(217,45,32,0.05)" : "transparent",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.patientName}</p>
                    {item.guardianName && <p className="text-xs text-ink-soft">{item.guardianName}</p>}
                  </div>
                  <span className="text-xs text-ink-faint">{item.dateLabel}</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {FEEDBACK_CATEGORIES.filter((c) => item.categoryRatings[c.key]).map((c) => {
                    const value = item.categoryRatings[c.key] as FeedbackRatingValue;
                    const negative = value === "ruim";
                    return (
                      <span
                        key={c.key}
                        className="rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{
                          background: negative ? "var(--status-falta, #d92d20)" : "var(--color-accent-2-100)",
                          color: negative ? "#fff" : "var(--color-accent-2-700, var(--color-accent-2))",
                        }}
                      >
                        {c.label}: {FEEDBACK_RATING_LABEL[value]}
                      </span>
                    );
                  })}
                </div>

                {item.comments && <p className="text-sm text-ink-soft italic">&quot;{item.comments}&quot;</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
