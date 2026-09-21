"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Stethoscope,
  User,
  X,
  XCircle,
} from "lucide-react";
import type { EvaluationPoolItem } from "@/lib/evaluation-agenda";
import { REJECT_REASON_OPTIONS, type IntakeRejectReasonCode } from "@/lib/intake-reject-reasons";
import {
  approveEvaluationDocsAction,
  getEvaluationQuickViewAction,
  rejectEvaluationDocsAction,
  sendEvaluationMessageAction,
  type EvaluationDocActionResult,
  type EvaluationQuickView,
  type QuickViewFile,
} from "./evaluation-quick-view-actions";

const PANEL_WIDTH = 360;
const VIEWPORT_MARGIN = 12;

/** Laudo e guia primeiro — são os dois que o supervisor abre em 90% dos casos. */
const KIND_ORDER: Record<QuickViewFile["kind"], number> = { laudo: 0, guia: 1, carteirinha: 2, outro: 3 };

const KIND_ICON: Record<QuickViewFile["kind"], typeof FileText> = {
  laudo: Stethoscope,
  guia: FileText,
  carteirinha: CreditCard,
  outro: FileText,
};

/** `+5591...` → link de WhatsApp; qualquer outro formato volta null (não inventa DDI). */
function whatsappHref(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

function Row({ icon: Icon, children }: { icon: typeof User; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] text-ink-soft">
      <Icon size={13} aria-hidden className="mt-px shrink-0 text-ink-faint" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

function FileLink({ file }: { file: QuickViewFile }) {
  const Icon = KIND_ICON[file.kind];
  const highlight = file.kind === "laudo" || file.kind === "guia";
  return (
    <a
      href={file.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-[11px] font-semibold no-underline hover:bg-paper"
      style={{
        borderColor: highlight ? "var(--color-accent)" : "var(--color-paper-line-strong)",
        color: highlight ? "var(--color-accent)" : "inherit",
      }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon size={14} aria-hidden className="shrink-0" />
        <span className="min-w-0">
          <span className="block truncate">{file.label}</span>
          {file.meta ? <span className="block truncate text-[10px] font-normal text-ink-faint">{file.meta}</span> : null}
        </span>
      </span>
      <ExternalLink size={12} aria-hidden className="shrink-0 text-ink-faint group-hover:text-ink" />
    </a>
  );
}

/** Atalhos de texto pra pendência de documento — a Supervisão edita antes de enviar. */
function messageTemplates(view: EvaluationQuickView): { label: string; text: string }[] {
  const greeting = view.guardianName ? `Olá, ${view.guardianName}!` : "Olá!";
  const child = view.patientName;
  return [
    {
      label: "Falta o laudo",
      text: `${greeting} Para agendar a avaliação de ${child}, ainda precisamos do laudo médico. Pode enviar a foto ou o PDF por aqui? 💙`,
    },
    {
      label: "Falta a carteirinha",
      text: `${greeting} Para agendar a avaliação de ${child}, precisamos da foto da carteirinha do plano (frente e verso). Pode enviar por aqui? 💙`,
    },
    {
      label: "Falta a guia",
      text: `${greeting} Para agendar a avaliação de ${child}, precisamos da guia/autorização do plano. Se ainda não tiver, é só avisar que a autorização é feita aqui na clínica. 💙`,
    },
    {
      label: "Documento ilegível",
      text: `${greeting} O documento de ${child} chegou com a imagem difícil de ler. Pode enviar uma nova foto, bem iluminada e sem cortes? 💙`,
    },
  ];
}

type ActionMode = "idle" | "reject" | "message";

/**
 * Ações rápidas da Supervisão sobre a documentação: aprovar (libera os
 * horários por WhatsApp), rejeitar com motivo e mandar mensagem manual com a
 * pendência. Aprovar/rejeitar fecham a janela (o card muda de fila);
 * mensagem só confirma o envio e deixa a janela aberta.
 */
function ReviewActions({
  view,
  item,
  scheduleLabel,
  therapistId,
  roomId,
  onResolved,
  onChanged,
}: {
  view: EvaluationQuickView;
  item: EvaluationPoolItem;
  scheduleLabel: string | null;
  therapistId: string;
  roomId: string;
  onResolved: (text: string) => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<ActionMode>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  const [reason, setReason] = useState<IntakeRejectReasonCode>("ilegivel");
  const [detail, setDetail] = useState("");
  const [text, setText] = useState("");

  const isLead = item.bookInput.origin === "convenio_pdf";
  const needsSchedule = isLead && (!therapistId || !roomId);

  async function run(action: () => Promise<EvaluationDocActionResult>, onSuccess: () => void) {
    setBusy(true);
    setError(null);
    setSentNotice(null);
    const res = await action();
    setBusy(false);
    if (res.success) {
      onSuccess();
    } else {
      setError(res.error);
      // A ação pode ter avançado o status mesmo devolvendo aviso (ex.: aprovou,
      // mas o WhatsApp falhou) — a fila precisa refletir o que mudou.
      onChanged();
    }
  }

  const approve = () =>
    run(
      () => approveEvaluationDocsAction(item.bookInput, therapistId, roomId),
      () => onResolved(`Documentação de ${item.patientName} aprovada — horários enviados ao responsável por WhatsApp.`),
    );

  const reject = () =>
    run(
      () => rejectEvaluationDocsAction(item.bookInput, reason, detail),
      () => onResolved(`Documentação de ${item.patientName} rejeitada — o responsável foi avisado por WhatsApp.`),
    );

  const sendMessage = () =>
    run(
      () => sendEvaluationMessageAction(item.bookInput, text),
      () => {
        setSentNotice("Mensagem enviada por WhatsApp.");
        setText("");
        setMode("idle");
      },
    );

  if (!view.canReview && !view.canMessage && !view.reviewNote) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-paper-line pt-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Ações rápidas</p>

      {view.reviewNote && !view.canReview && <p className="text-[11px] text-ink-faint">{view.reviewNote}</p>}

      {mode === "idle" && (
        <div className="flex flex-col gap-1.5">
          {view.canReview && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={approve}
                  disabled={busy || needsSchedule}
                  className="btn btn-primary flex-1 py-2 text-xs"
                >
                  <CheckCircle2 size={14} aria-hidden />
                  {busy ? "Enviando…" : "Aprovar e liberar horários"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode("reject");
                  }}
                  disabled={busy}
                  className="btn btn-secondary py-2 text-xs"
                >
                  <XCircle size={14} aria-hidden />
                  Rejeitar
                </button>
              </div>
              {isLead && !needsSchedule && scheduleLabel && (
                <p className="text-[10px] text-ink-faint">Horários oferecidos ao responsável: {scheduleLabel}.</p>
              )}
              {needsSchedule && <p className="text-[10px] text-ink-faint">Selecione terapeuta e sala no topo do calendário para aprovar.</p>}
            </>
          )}
          {view.canMessage && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSentNotice(null);
                setMode("message");
              }}
              disabled={busy}
              className="btn btn-ghost justify-center border border-paper-line-strong py-2 text-xs"
            >
              <MessageCircle size={14} aria-hidden />
              Enviar mensagem sobre a pendência
            </button>
          )}
        </div>
      )}

      {mode === "reject" && (
        <div className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-2.5">
          <label className="text-[11px] font-semibold text-red-700" htmlFor={`reject-reason-${item.id}`}>
            Motivo da rejeição
          </label>
          <select
            id={`reject-reason-${item.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value as IntakeRejectReasonCode)}
            className="input text-xs"
          >
            {REJECT_REASON_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <textarea
            rows={2}
            maxLength={300}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={
              reason === "outro"
                ? "Descreva o que precisa ser corrigido…"
                : "Observação para o responsável (opcional) — ex.: falta o verso da carteirinha"
            }
            className="input text-xs"
            aria-label="Observação sobre a rejeição"
          />
          <p className="text-[10px] text-red-700/80">O responsável recebe o motivo por WhatsApp e pode reenviar os documentos.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMode("idle")} disabled={busy} className="btn btn-ghost px-2.5 py-1 text-xs">
              Cancelar
            </button>
            <button
              type="button"
              onClick={reject}
              disabled={busy || (reason === "outro" && !detail.trim())}
              className="btn bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
            >
              {busy ? "Enviando…" : "Confirmar rejeição"}
            </button>
          </div>
        </div>
      )}

      {mode === "message" && (
        <div className="flex flex-col gap-2 rounded-md border border-paper-line-strong bg-paper/40 p-2.5">
          <div className="flex flex-wrap gap-1">
            {messageTemplates(view).map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setText(t.text)}
                className="rounded-full border border-paper-line-strong bg-white px-2 py-0.5 text-[10px] font-semibold text-ink-soft hover:border-[var(--color-accent)]"
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            rows={4}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escolha um atalho acima ou escreva qual é a pendência do documento…"
            className="input text-xs"
            aria-label="Mensagem para o responsável"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMode("idle")} disabled={busy} className="btn btn-ghost px-2.5 py-1 text-xs">
              Cancelar
            </button>
            <button type="button" onClick={sendMessage} disabled={busy || !text.trim()} className="btn btn-primary px-3 py-1 text-xs">
              <Send size={12} aria-hidden />
              {busy ? "Enviando…" : "Enviar WhatsApp"}
            </button>
          </div>
        </div>
      )}

      {sentNotice && <p className="text-[11px] font-semibold text-status-positive-text">{sentNotice}</p>}
      {error && (
        <p role="alert" className="text-[11px] text-status-negative-text">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Janela flutuante de um paciente da fila "Aguardando agendamento" do
 * calendário de 1ª avaliação. Abre no clique do card: laudo, guia e
 * carteirinha em um clique, contato do responsável, dados de convênio e —
 * quando a documentação espera a Supervisão — as ações rápidas de aprovar,
 * rejeitar ou mandar uma mensagem manual com a pendência. Agendar continua
 * sendo arrastar o card pro calendário — por isso a janela é ancorada ao
 * lado da fila, e não um modal que tampa a grade.
 */
export function EvaluationQuickViewPanel({
  item,
  anchorRect,
  therapistId,
  roomId,
  scheduleLabel,
  onClose,
  onResolved,
  onChanged,
}: {
  item: EvaluationPoolItem;
  anchorRect: DOMRect | null;
  /** Avaliador/sala escolhidos no calendário — definem os horários oferecidos ao aprovar um acolhimento de PDF. */
  therapistId: string;
  roomId: string;
  scheduleLabel: string | null;
  onClose: () => void;
  /** Aprovou/rejeitou: o pai fecha a janela e recarrega a fila. */
  onResolved: (text: string) => void;
  /** Algo mudou no servidor mas a janela continua útil (ex.: aprovou, WhatsApp falhou). */
  onChanged: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<EvaluationQuickView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  // A janela é remontada a cada card aberto (key no pai), então o estado
  // inicial já é o "carregando" — o efeito só precisa preencher o resultado.
  useEffect(() => {
    let cancelled = false;
    getEvaluationQuickViewAction(item.bookInput).then((res) => {
      if (cancelled) return;
      if (res.success) setView(res.view);
      else setError(res.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [item.bookInput]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Posição fixa calculada a partir do card clicado: ao lado da fila, e
  // deslocada pra cima quando o card está no fim da lista — senão a janela
  // nasceria abaixo da dobra e o supervisor teria que rolar a página. A
  // altura muda quando os dados chegam e quando o formulário de rejeição/
  // mensagem abre, por isso reposiciona a cada mudança de tamanho.
  useLayoutEffect(() => {
    if (!anchorRect) return;
    const panel = panelRef.current;
    function reposition() {
      const height = panel?.offsetHeight ?? 320;
      const left = Math.min(anchorRect!.right + 8, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
      const top = Math.max(VIEWPORT_MARGIN, Math.min(anchorRect!.top, window.innerHeight - height - VIEWPORT_MARGIN));
      setPosition((prev) => {
        const next = { left: Math.max(VIEWPORT_MARGIN, left), top };
        return prev && prev.left === next.left && prev.top === next.top ? prev : next;
      });
    }
    reposition();
    if (!panel || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(reposition);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [anchorRect]);

  const files = view ? [...view.files].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]) : [];
  const waHref = whatsappHref(view?.guardianPhone ?? null);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`Consulta rápida — ${item.patientName}`}
        className="fixed z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-lg border border-paper-line-strong bg-white shadow-xl"
        style={{ width: PANEL_WIDTH, left: position?.left ?? -9999, top: position?.top ?? -9999 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-paper-line px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{item.patientName}</p>
            <p className="truncate text-[11px] text-ink-faint">{view?.originLabel ?? item.detail}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar consulta rápida" className="shrink-0 text-ink-faint hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-3.5 py-3">
          {loading && <p className="text-[11px] italic text-ink-faint">Carregando dados do paciente…</p>}
          {!loading && error && <p className="text-[11px] text-status-negative-text">{error}</p>}

          {view && (
            <>
              <div className="flex flex-col gap-1">
                {view.guardianName && <Row icon={User}>Responsável: <strong className="font-semibold text-ink">{view.guardianName}</strong></Row>}
                {view.guardianPhone && (
                  <Row icon={Phone}>
                    <a href={`tel:${view.guardianPhone.replace(/\s/g, "")}`} className="font-mono text-ink underline underline-offset-2 hover:no-underline">
                      {view.guardianPhone}
                    </a>
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center gap-1 font-semibold no-underline"
                        style={{ color: "var(--color-accent)" }}
                      >
                        <MessageCircle size={12} aria-hidden />
                        WhatsApp
                      </a>
                    )}
                  </Row>
                )}
                {view.guardianEmail && <Row icon={Mail}>{view.guardianEmail}</Row>}
                {view.insuranceLabel && <Row icon={CreditCard}>{view.insuranceLabel}</Row>}
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">Documentos</p>
                {files.length === 0 ? (
                  <p className="text-[11px] text-ink-faint">Nenhum documento anexado até agora.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {files.map((f) => (
                      <FileLink key={f.key} file={f} />
                    ))}
                  </div>
                )}
              </div>

              {view.laudoSummary && (
                <div className="rounded-md border border-paper-line-strong bg-paper/40 p-2.5">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft">Resumo do laudo (IA)</p>
                  <p className="text-[11px] leading-relaxed text-ink-soft">{view.laudoSummary}</p>
                </div>
              )}

              {view.fields.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {view.fields.map((f) => (
                    <div key={f.label} className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{f.label}</dt>
                      <dd className="break-words text-[11px] font-medium text-ink">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {view.warnings.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {view.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-1.5 text-[11px]" style={{ color: "var(--color-status-negative-text)" }}>
                      <AlertTriangle size={12} aria-hidden className="mt-px shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}

              <ReviewActions
                view={view}
                item={item}
                scheduleLabel={scheduleLabel}
                therapistId={therapistId}
                roomId={roomId}
                onResolved={onResolved}
                onChanged={onChanged}
              />
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-paper-line px-3.5 py-2.5">
          <p className="text-[10px] text-ink-faint">
            {item.ready ? "Arraste o card para o calendário para agendar." : "Aprove a documentação antes de agendar."}
          </p>
          {view?.patientHref && (
            <Link href={view.patientHref} className="shrink-0 text-[11px] font-semibold text-accent underline underline-offset-2 hover:no-underline">
              Prontuário
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
