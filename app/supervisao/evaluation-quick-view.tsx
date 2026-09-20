"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CreditCard,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Stethoscope,
  User,
  X,
} from "lucide-react";
import type { EvaluationPoolItem } from "@/lib/evaluation-agenda";
import { getEvaluationQuickViewAction, type EvaluationQuickView, type QuickViewFile } from "./evaluation-quick-view-actions";

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

/**
 * Janela flutuante de consulta rápida de um paciente da fila "Aguardando
 * agendamento" do calendário de 1ª avaliação. Abre no clique do card e só
 * lê: laudo, guia e carteirinha em um clique, contato do responsável e os
 * dados de convênio/autorização que a Supervisão confere antes de escolher
 * o horário. Agendar continua sendo arrastar o card pro calendário — por
 * isso a janela é ancorada ao lado da fila, e não um modal que tampa a
 * grade.
 */
export function EvaluationQuickViewPanel({
  item,
  anchorRect,
  onClose,
}: {
  item: EvaluationPoolItem;
  anchorRect: DOMRect | null;
  onClose: () => void;
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
  // nasceria abaixo da dobra e o supervisor teria que rolar a página.
  useLayoutEffect(() => {
    if (!anchorRect) return;
    const height = panelRef.current?.offsetHeight ?? 320;
    const left = Math.min(anchorRect.right + 8, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
    const top = Math.max(VIEWPORT_MARGIN, Math.min(anchorRect.top, window.innerHeight - height - VIEWPORT_MARGIN));
    setPosition({ left: Math.max(VIEWPORT_MARGIN, left), top });
  }, [anchorRect, loading, view]);

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
