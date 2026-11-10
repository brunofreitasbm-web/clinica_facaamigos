"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, FileText, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { chatHref } from "@/lib/atendimento/chat-deep-link-pure";
import {
  TRAIL_LABELS,
  buildHistory,
  portalFields,
  trailStates,
  waitLabel,
  type FilaItem,
  type TrailState,
} from "@/lib/fila/fila-model-pure";
import { DraftAdjustButton } from "../pacientes/pendencias/draft-adjust-dialog";
import { MoveToLastButton } from "../pacientes/pendencias/move-to-last-button";
import { ReassignOwnerButton } from "../pacientes/pendencias/reassign-owner-button";
import { getFilaDetail, type FilaDetail } from "./fila-detail-action";
import { FilaNextStep } from "./fila-next-step";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; detail: FilaDetail };

const DOC_STATE_LABEL: Record<string, string> = {
  ok: "Recebido",
  faltando: "Falta",
  aviso: "Conferir",
  analisando: "Lendo",
  nao_se_aplica: "Não se aplica",
};

const TRAIL_STYLE: Record<TrailState, string> = {
  done: "border-transparent bg-paper",
  current: "border-[var(--color-accent)] bg-[var(--color-accent-100)]",
  locked: "border-dashed border-paper-line-strong bg-white",
};

/**
 * Detalhe de uma família. O que muda é só o cartão "Próximo passo"; o resto é consulta (documentos, dados para
 * copiar, histórico) e ações secundárias, sem virar telas. Carregado sob demanda: a lista só leva o resumo.
 */
export function FilaDetailPanel({
  item,
  owners,
  nowMs,
}: {
  item: FilaItem;
  owners: { id: string; full_name: string }[];
  nowMs: number;
}) {
  const { toast } = useToast();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  // Recarrega quando muda a família ou quando a lista foi atualizada (uma ação mudou o estado dela).
  const stateKey = `${item.draftId}|${item.group}|${item.step.kind}|${item.missingCount}|${reloadKey}`;
  useEffect(() => {
    let cancelled = false;
    getFilaDetail(item.draftId)
      .then((res) => {
        if (cancelled) return;
        setLoad(res.success ? { status: "ready", detail: res.detail } : { status: "error", message: res.error });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: "error", message: "Não foi possível carregar os detalhes." });
      });
    return () => {
      cancelled = true;
    };
    // stateKey reúne exatamente o que deve disparar nova leitura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  const detail = load.status === "ready" ? load.detail : null;
  const trail = trailStates(item);
  const docPills = detail?.pills.filter((p) => p.group === "documento") ?? [];
  const fields = useMemo(() => portalFields(detail?.facts ?? []), [detail]);
  const history = useMemo(
    () =>
      detail
        ? buildHistory({ createdAt: detail.createdAt, pipeline: detail.pipeline, documentRequests: detail.documentRequests })
        : [],
    [detail],
  );

  const copy = (label: string, value: string) => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(label);
        setTimeout(() => setCopied(null), 1500);
        toast(`${label} copiado.`, "success");
      })
      .catch(() => toast("Não foi possível copiar.", "error"));
  };

  const headline = [
    item.guardian ? `Responsável: ${item.guardian}` : null,
    item.plan,
    `na fila ${waitLabel(item.createdAt, nowMs, false)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="m-0 break-words font-[var(--font-display)] text-[28px] font-semibold leading-tight text-ink">{item.child}</h2>
          <p className="m-0 mt-1 text-base text-ink-soft">{headline}</p>
        </div>
        <MoveToLastButton itemId={item.id} patientName={item.child} isPostponed={item.postponed} />
      </div>

      {item.returned && (
        <p role="status" className="m-0 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
          Devolvido pela Supervisão{item.returned.byName ? ` (${item.returned.byName})` : ""}: {item.returned.reason}
        </p>
      )}
      {detail?.mergedDraftsCount && detail.mergedDraftsCount > 1 ? (
        <p className="m-0 text-sm text-ink-soft">
          Informações unificadas de {detail.mergedDraftsCount} conversas enviadas pelo responsável.
        </p>
      ) : null}

      <ol aria-label="Etapas" className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
        {TRAIL_LABELS.map((label, index) => {
          const state = trail[index];
          return (
            <li key={label} className={`rounded-2xl border-[1.5px] p-3.5 ${TRAIL_STYLE[state]}`}>
              <span
                aria-hidden
                className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-[15px] font-extrabold ${
                  state === "done"
                    ? "bg-[var(--color-dark)] text-white"
                    : state === "current"
                      ? "bg-[var(--color-accent)] text-white"
                      : "border-[1.5px] border-paper-line-strong bg-white text-ink-soft"
                }`}
              >
                {state === "done" ? <Check size={16} /> : index + 1}
              </span>
              <span className="mt-2 block text-[15px] font-extrabold text-ink">{label}</span>
              <span className={`block text-sm ${state === "current" ? "font-extrabold text-[var(--color-accent)]" : "text-ink-soft"}`}>
                {state === "done" ? "Concluída" : state === "current" ? "Agora" : "Depois"}
              </span>
            </li>
          );
        })}
      </ol>

      <FilaNextStep item={item} detail={detail} />

      {load.status === "loading" && (
        <div role="status" aria-label="Carregando detalhes" className="flex flex-col gap-3">
          <div className="skeleton-shimmer h-16 rounded-xl" />
          <div className="skeleton-shimmer h-24 rounded-xl" />
        </div>
      )}
      {load.status === "error" && (
        <p role="alert" className="m-0 text-base text-status-negative-text">
          {load.message}{" "}
          <button type="button" className="font-semibold underline" onClick={() => setReloadKey((k) => k + 1)}>
            Tentar de novo
          </button>
        </p>
      )}

      {detail && (
        <>
          {(detail.error || detail.warnings.length > 0) && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-status-negative-text">
              {detail.error && <li>Leitura automática falhou: {detail.error}</li>}
              {detail.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-6">
            <div className="min-w-0 flex-1 basis-[280px]">
              <h3 className="m-0 mb-2.5 text-[17px] font-extrabold text-ink">Documentos</h3>
              {docPills.length === 0 ? (
                <p className="m-0 text-base text-ink-soft">Nenhum documento exigido para este contato.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {docPills.map((pill) => (
                    <li
                      key={pill.key}
                      className={`flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-xl border-[1.5px] px-3.5 py-2 ${
                        pill.state === "faltando" ? "border-amber-700 bg-amber-50 text-amber-900" : "border-paper bg-paper text-ink"
                      }`}
                    >
                      <span className="text-base font-bold">{pill.label}</span>
                      <span className="text-[15px] font-bold">{DOC_STATE_LABEL[pill.state] ?? pill.state}</span>
                    </li>
                  ))}
                </ul>
              )}
              {detail.files.length > 0 && (
                <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
                  {detail.files.map((file) => {
                    const isImage = file.mimeType.startsWith("image/");
                    return (
                      <li key={file.id}>
                        <a
                          href={`/api/arquivos/rascunho/${file.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-paper-line-strong bg-white px-3 text-sm font-medium text-ink no-underline hover:border-[var(--color-accent)]"
                        >
                          {isImage ? <ImageIcon size={14} aria-hidden /> : <FileText size={14} aria-hidden />}
                          <span className="truncate">{file.name}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="min-w-0 flex-1 basis-[320px]">
              <h3 className="m-0 mb-2.5 text-[17px] font-extrabold text-ink">Dados para o portal</h3>
              {fields.length === 0 ? (
                <p className="m-0 text-base text-ink-soft">Ainda não há dados lidos. Peça os documentos ou confira o cadastro.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {fields.map((f) => (
                    <li
                      key={f.label}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-paper-line-strong py-1 pl-3.5 pr-1.5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-ink-soft">{f.label}</div>
                        <div className="break-words text-[17px] font-bold text-ink">{f.value}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copy(f.label, f.value)}
                        aria-label={`Copiar ${f.label}`}
                        className="btn btn-secondary shrink-0 gap-1.5 text-[15px]"
                      >
                        {copied === f.label ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                        Copiar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <h3 className="m-0 mb-2.5 text-[17px] font-extrabold text-ink">Histórico</h3>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {history.map((event, index) => (
                <li key={`${event.at}-${index}`} className="flex flex-wrap gap-x-3.5 text-[15px] text-ink">
                  <span className="w-44 flex-none whitespace-nowrap text-ink-soft">{fmtDateTime(event.at, CLINIC_TIMEZONE)}</span>
                  <span>{event.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-paper-line pt-4 text-[15px]">
        {item.phone && (
          <Link href={chatHref({ phone: item.phone })} className="font-semibold text-[var(--color-accent)]">
            Abrir conversa no Chat
          </Link>
        )}
        <Link href={`/recepcao/pre-cadastros/${item.draftId}`} className="font-semibold text-[var(--color-accent)]">
          Conferir e cadastrar
        </Link>
        <DraftAdjustButton draftId={item.draftId} />
        <span className="flex items-center gap-2 text-ink-soft">
          Responsável: <strong className="text-ink">{item.assignedToName ?? "sem dono"}</strong>
          {owners.length > 0 && <ReassignOwnerButton itemId={item.id} currentAssigneeId={item.assignedToId} candidates={owners} />}
        </span>
      </div>
    </div>
  );
}
