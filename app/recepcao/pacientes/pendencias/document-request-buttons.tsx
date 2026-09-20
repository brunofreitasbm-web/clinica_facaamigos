"use client";

import { useState, useTransition } from "react";
import { fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import {
  MISSING_DOCUMENT_TEMPLATES,
  buildMissingDocumentMessage,
  type MissingDocumentKey,
} from "@/lib/document-request-templates";
import type { PendingDraftDocumentRequest } from "@/lib/reception-queue";
import { requestMissingDocument } from "./document-request-actions";

/**
 * Ação rápida de cobrança de documento (fila de pendências).
 *
 * Um clique = mensagem enviada. Não tem diálogo de confirmação de propósito
 * (é o pedido de quem usa: o balcão cobra o mesmo laudo dezenas de vezes por
 * semana), então o texto exato fica visível em "ver a mensagem" logo abaixo
 * e cada botão mostra a data da última cobrança — é o que evita a família
 * receber a mesma mensagem duas vezes na troca de plantão.
 */
export function DocumentRequestButtons({
  draftId,
  patientName,
  hasPhone,
  requests,
}: {
  draftId: string;
  patientName: string | null;
  hasPhone: boolean;
  requests: PendingDraftDocumentRequest[];
}) {
  const [sentAtByKey, setSentAtByKey] = useState<Record<string, string>>(() =>
    Object.fromEntries(requests.map((r) => [r.key, r.sentAt])),
  );
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [pendingKey, setPendingKey] = useState<MissingDocumentKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const send = (key: MissingDocumentKey) => {
    setFeedback(null);
    setPendingKey(key);
    startTransition(async () => {
      const result = await requestMissingDocument(draftId, key);
      setPendingKey(null);
      if (!result.success) {
        setFeedback({ tone: "error", text: result.error });
        return;
      }
      setSentAtByKey((prev) => ({ ...prev, [key]: result.sentAt }));
      setFeedback(
        result.warning
          ? { tone: "warn", text: result.warning }
          : { tone: "ok", text: "Cobrança enviada pelo WhatsApp." },
      );
    });
  };

  return (
    <section className="rounded-md border border-paper-line-strong bg-paper/40 px-3 py-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Cobrar documento pelo WhatsApp
      </h3>
      <p className="m-0 mb-2 text-[12px] text-ink-faint">
        Um clique envia a mensagem para a família explicando qual documento falta e que a autorização
        junto ao plano fica parada até ele chegar.
      </p>

      <div className="flex flex-wrap gap-2">
        {MISSING_DOCUMENT_TEMPLATES.map((template, index) => {
          const sentAt = sentAtByKey[template.key];
          const busy = isPending && pendingKey === template.key;
          // O laudo médico é o primeiro da lista e vem em destaque: é a
          // cobrança recorrente que motivou a ação rápida.
          const primary = index === 0;
          return (
            <button
              key={template.key}
              type="button"
              disabled={isPending || !hasPhone}
              onClick={() => send(template.key)}
              title={buildMissingDocumentMessage(template, patientName)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                primary
                  ? "border-0 text-white"
                  : "border border-paper-line-strong bg-paper text-ink hover:bg-paper-subtle"
              }`}
              style={primary ? { backgroundColor: "var(--color-accent)" } : undefined}
            >
              {busy ? "Enviando…" : `Cobrar ${template.label.toLowerCase()}`}
              {sentAt && (
                <span className={`ml-1.5 font-normal ${primary ? "text-white/80" : "text-ink-faint"}`}>
                  · cobrado {fmtDateTime(sentAt, CLINIC_TIMEZONE)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!hasPhone && (
        <p className="m-0 mt-2 text-[12px] text-ink-faint">
          Contato sem telefone de WhatsApp — a cobrança precisa ser feita pelo canal por onde ele chegou.
        </p>
      )}

      {feedback && (
        <p
          className={`m-0 mt-2 text-[12px] ${
            feedback.tone === "error"
              ? "text-status-negative-text"
              : feedback.tone === "warn"
                ? "text-ink-soft"
                : "text-status-positive-text"
          }`}
        >
          {feedback.tone === "ok" ? "✓ " : ""}
          {feedback.text}
        </p>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-[12px] text-ink-soft">Ver a mensagem que será enviada</summary>
        <pre className="mt-1 whitespace-pre-wrap rounded-md bg-paper px-3 py-2 font-sans text-[12px] text-ink">
          {buildMissingDocumentMessage(MISSING_DOCUMENT_TEMPLATES[0], patientName)}
        </pre>
      </details>
    </section>
  );
}
