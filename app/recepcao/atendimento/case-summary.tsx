"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ClipboardList, Copy, ExternalLink } from "lucide-react";
import { getCaseSummaryData, type CaseSummaryData } from "./case-summary-actions";
import { formatConversationPhone } from "./format-phone";
import { buildCaseSummary } from "@/lib/atendimento/case-summary-pure";
import type { ConversationRow } from "@/lib/atendimento/types";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: CaseSummaryData };

/**
 * Resumo do caso no topo do painel lateral (desktop e celular): quem é, plano, etapa, por que veio para a
 * equipe e UM próximo passo. Substitui rolar a conversa ou abrir o modal de pendências só para saber isso.
 *
 * Leis de UX: Miller (no máximo 5 blocos), Proximidade (cada bloco agrupa um assunto), Von Restorff (só o
 * aviso e o próximo passo se destacam), Jakob (mesma ordem para lead e paciente), Tesler (o sistema já
 * cruza conversa, rascunho e cadastro; o operador não precisa montar isso de cabeça).
 */
export function CaseSummary({
  conversation,
  onResolvePendencies,
  resolving = false,
  refreshToken = 0,
}: {
  conversation: ConversationRow;
  /** Abre as pendências do lead (modal no desktop, tela de pendências no celular). */
  onResolvePendencies?: () => void;
  resolving?: boolean;
  /** Muda quando algo que altera o resumo aconteceu (ex.: IA terminou de ler os documentos). */
  refreshToken?: number;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);
  // Idade calculada contra um instante fixo por montagem: render puro, sem Date.now() solto.
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    getCaseSummaryData(conversation.id)
      .then((res) => {
        if (cancelled) return;
        setState(res.success ? { status: "ready", data: res } : { status: "error" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // patientId/patientStatus: o vínculo muda quando o lead vira interessado/paciente com a conversa aberta.
  }, [conversation.id, conversation.patientId, conversation.patientStatus, refreshToken, reloadKey]);

  const data = state.status === "ready" ? state.data : null;
  const summary = useMemo(
    () =>
      buildCaseSummary({
        conversation: {
          kind: conversation.kind,
          phoneNumber: conversation.phoneNumber,
          displayName: conversation.displayName,
          contactName: conversation.contactName,
          guardianName: conversation.guardianName,
          planName: conversation.planName,
          escalationReason: conversation.escalationReason,
          patientId: conversation.patientId,
          patientStatus: conversation.patientStatus,
        },
        draft: data?.draft ?? null,
        patient: data?.patient ?? null,
        insurance: data?.insurance ?? [],
        nowMs,
      }),
    [conversation, data, nowMs],
  );

  const phone = formatConversationPhone(conversation.phoneNumber);
  const loading = state.status === "loading";
  const failed = state.status === "error";
  const { next } = summary;

  return (
    <section aria-label="Resumo do caso" className="flex flex-col gap-3">
      <div className="min-w-0">
        <h3 className="m-0 break-words text-[15px] font-semibold text-ink">{summary.headline}</h3>
        {summary.stage && (
          <span
            title={summary.stage.label}
            className={`mt-1 inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[13px] font-medium ${
              summary.stage.allDone
                ? "border-status-positive-text/60 text-status-positive-text"
                : "border-[var(--color-accent)] text-ink"
            }`}
          >
            {summary.stage.label}
          </span>
        )}
      </div>

      <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-[13px]">
        {summary.details.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-ink-soft">{row.label}</dt>
            <dd className="m-0 min-w-0 break-words text-ink">{row.value}</dd>
          </div>
        ))}
        <dt className="text-ink-soft">Telefone</dt>
        <dd className="m-0 min-w-0">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(phone).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="inline-flex items-center gap-1.5 text-ink hover:underline"
            title="Copiar telefone"
          >
            {phone}
            {copied ? <Check size={12} className="text-status-active" aria-hidden /> : <Copy size={12} className="opacity-60" aria-hidden />}
            <span className="sr-only">{copied ? "Telefone copiado" : "Copiar telefone"}</span>
          </button>
        </dd>
        <dt className="text-ink-soft">Plano</dt>
        <dd className={`m-0 min-w-0 break-words ${summary.plan.tone === "unknown" ? "italic text-ink-faint" : "text-ink"}`}>
          {summary.plan.text}
        </dd>
      </dl>

      {summary.warning && (
        <p role="status" className="m-0 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {summary.warning}
        </p>
      )}

      {summary.reason && (
        <div
          className="rounded-md p-2.5 text-xs"
          style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-700)" }}
        >
          <div className="mb-0.5 font-semibold">Por que está com a equipe</div>
          {summary.reason}
        </div>
      )}

      {failed && (
        <p role="alert" className="m-0 text-xs text-red-700 dark:text-red-400">
          Não foi possível carregar o resumo.{" "}
          <button type="button" className="font-semibold underline" onClick={() => setReloadKey((k) => k + 1)}>
            Tentar de novo
          </button>
        </p>
      )}

      {loading ? (
        <p role="status" className="m-0 text-xs text-ink-faint">
          Carregando situação do caso…
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {next.note && <p className="m-0 text-xs text-ink-soft">{next.note}</p>}
          {next.kind === "resolve_pendencies" && onResolvePendencies && (
            <button
              type="button"
              disabled={resolving}
              onClick={onResolvePendencies}
              className="btn btn-primary w-full justify-center gap-1.5 text-sm"
            >
              <ClipboardList size={14} aria-hidden />
              {resolving ? "Abrindo…" : next.label}
            </button>
          )}
          {(next.kind === "open_authorization" || next.kind === "open_patient") && next.href && (
            <Link href={next.href} className="btn btn-primary w-full justify-center gap-1.5 text-sm">
              {next.kind === "open_authorization" && <ExternalLink size={14} aria-hidden />}
              {next.label}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
