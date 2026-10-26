"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, X } from "lucide-react";
import type { AuthorizationWizardItem } from "@/lib/reception-queue";
import { registerAuthorizationRenewalResponse, requestAuthorizationRenewal } from "./authorization-renewal-actions";
import { finishWhatsappWindow, preOpenWhatsappWindow } from "./open-whatsapp";
import { suggestedRenewalPeriod, validateRenewalPeriod } from "./authorization-renewal-pure";

export type AuthorizationItem = AuthorizationWizardItem;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "—";
  return `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
}

type Dialog =
  | { kind: "request"; item: AuthorizationItem }
  | { kind: "response"; item: AuthorizationItem };

/**
 * Pacotes de sessões autorizadas pelo plano, com o saldo de cada guia ativa.
 *
 * A renovação tem dois passos, os dois gravados no banco
 * (authorization-renewal-actions.ts):
 *   1. "Pedir renovação" — grava a guia nova como pendente, ligada à atual;
 *   2. "Registrar resposta do plano" — autorizada (número, sessões, vigência)
 *      ou negada.
 */
export function AutorizacaoWizard({ initialItems = [] }: { initialItems?: AuthorizationItem[] }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-md bg-status-positive-soft px-4 py-3 text-[15px] text-status-positive-text">
          <span className="flex items-center gap-2 font-semibold">
            <Check className="h-4 w-4" aria-hidden="true" /> {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="text-status-positive-text">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <p className="m-0 text-[15px] text-ink-soft">
        Saldo das guias ativas, agrupado por paciente. O agendamento é bloqueado quando as sessões autorizadas acabam.
      </p>

      {initialItems.length === 0 ? (
        <p className="m-0 text-[15px] text-ink-soft">Nenhuma guia ativa no momento.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {groupByPatient(initialItems).map((group) => (
            <PatientGroup key={group.patientId} group={group} onOpen={setDialog} />
          ))}
        </ul>
      )}

      {dialog?.kind === "request" && (
        <RequestRenewalDialog item={dialog.item} onClose={() => setDialog(null)} onDone={() => done("Pedido de renovação registrado. Falta registrar a resposta do plano.")} />
      )}
      {dialog?.kind === "response" && dialog.item.renewal && (
        <RenewalResponseDialog item={{ ...dialog.item, renewal: dialog.item.renewal }} onClose={() => setDialog(null)} onDone={done} />
      )}
    </div>
  );
}

type PatientGroupData = {
  patientId: string;
  patientName: string;
  items: AuthorizationItem[];
};

const STATUS_PRIORITY = { critical: 0, attention: 1, regular: 2 } as const;

/** Um card por paciente; as guias dele ficam dentro. Itens já chegam ordenados por urgência. */
function groupByPatient(items: AuthorizationItem[]): PatientGroupData[] {
  const groups = new Map<string, PatientGroupData>();
  for (const item of items) {
    const group = groups.get(item.patientId);
    if (group) group.items.push(item);
    else groups.set(item.patientId, { patientId: item.patientId, patientName: item.patientName, items: [item] });
  }
  const worst = (g: PatientGroupData) => Math.min(...g.items.map((i) => STATUS_PRIORITY[i.status]));
  return [...groups.values()].sort((a, b) => worst(a) - worst(b) || a.patientName.localeCompare(b.patientName, "pt-BR"));
}

function PatientGroup({ group, onOpen }: { group: PatientGroupData; onOpen: (d: Dialog) => void }) {
  const total = group.items.reduce((sum, i) => sum + i.authorizedHours, 0);
  const used = group.items.reduce((sum, i) => sum + i.consumedHours, 0);
  const insurers = [...new Set(group.items.map((i) => i.insurerName))].join(", ");

  return (
    <li className="flex flex-col gap-3 rounded-md border border-paper-line-strong bg-paper-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-paper-line pb-2">
        <div className="flex flex-col">
          <span className="text-base font-bold text-ink">{group.patientName}</span>
          <span className="text-sm text-ink-soft">{insurers}</span>
        </div>
        <span className="text-sm text-ink-soft">
          {group.items.length === 1 ? "1 guia" : `${group.items.length} guias`} ·{" "}
          <strong className="text-ink tabular-figure">{used}</strong> de <span className="tabular-figure">{total}</span> sessões usadas
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {group.items.map((item) => (
          <AuthorizationRow key={item.id} item={item} onOpen={onOpen} />
        ))}
      </ul>
    </li>
  );
}

function AuthorizationRow({ item, onOpen }: { item: AuthorizationItem; onOpen: (d: Dialog) => void }) {
  const pct = item.authorizedHours > 0 ? Math.min(100, Math.round((item.consumedHours / item.authorizedHours) * 100)) : 0;
  const remaining = item.authorizedHours - item.consumedHours;
  const tone = item.renewal ? "neutral" : item.status === "critical" ? "negative" : item.status === "attention" ? "pending" : "positive";
  const toneText = {
    negative: "text-status-negative-text",
    pending: "text-status-pending-text",
    positive: "text-status-positive-text",
    neutral: "text-ink-soft",
  }[tone];
  const toneBar = {
    negative: "bg-status-negative",
    pending: "bg-status-pending",
    positive: "bg-status-positive",
    neutral: "bg-ink-soft",
  }[tone];

  return (
    <li
      className={`flex flex-col gap-4 rounded-md border p-3 md:flex-row md:items-center md:justify-between ${
        tone === "negative" ? "border-status-negative-text/40 bg-status-negative-soft/40" : "border-paper-line bg-paper"
      }`}
    >
      <div className="flex min-w-[260px] flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-paper-surface px-1.5 py-0.5 text-[13px] tabular-figure text-ink-soft">{item.protocolNumber}</span>
          <span className="text-sm font-semibold text-ink">{item.specialty}</span>
        </span>
        <span className="text-sm text-ink-soft">{item.insurerName}</span>
      </div>

      <div className="max-w-md flex-1">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-ink-soft">
            <strong className="text-ink tabular-figure">{item.consumedHours}</strong> de{" "}
            <span className="tabular-figure">{item.authorizedHours}</span> sessões usadas
          </span>
          <span className={`font-bold tabular-figure ${toneText}`}>{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-line">
          <div className={`h-full rounded-full ${toneBar}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex justify-between gap-3 text-[13px] text-ink-soft">
          <span>Vale até {fmtDate(item.expiresAt)}</span>
          {item.status === "critical" && !item.renewal && (
            <span className="font-bold text-status-negative-text">
              {remaining === 1 ? "Resta 1 sessão" : `Restam ${remaining} sessões`}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-1 md:items-end">
        {item.renewal ? (
          <>
            <span className="text-sm text-ink-soft">
              {item.renewal.requestedAt ? `Renovação pedida em ${fmtDate(item.renewal.requestedAt)}` : "Renovação pedida"} ·{" "}
              {item.renewal.sessionsRequested} sessões
            </span>
            <button type="button" onClick={() => onOpen({ kind: "response", item })} className="btn btn-primary">
              Registrar resposta do plano
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onOpen({ kind: "request", item })}
            className={`btn ${item.status === "critical" ? "btn-primary" : "btn-secondary"}`}
          >
            Pedir renovação
          </button>
        )}
      </div>
    </li>
  );
}

function DialogShell({ title, step, onClose, children }: { title: string; step?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-xl rounded-lg bg-paper-surface p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-paper-line pb-3">
          <div>
            {step && <p className="m-0 text-sm font-semibold text-ink-soft">{step}</p>}
            <h3 className="m-0 text-lg font-bold text-ink">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-md border border-paper-line-strong bg-paper-surface px-3 text-[15px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

function PeriodFields({
  sessions,
  validFrom,
  validTo,
  onChange,
  sessionsLabel,
}: {
  sessions: string;
  validFrom: string;
  validTo: string;
  onChange: (patch: Partial<{ sessions: string; validFrom: string; validTo: string }>) => void;
  sessionsLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        {sessionsLabel}
        <input type="number" min={1} step={1} inputMode="numeric" value={sessions} onChange={(e) => onChange({ sessions: e.target.value })} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        Vigência: início
        <input type="date" value={validFrom} onChange={(e) => onChange({ validFrom: e.target.value })} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
        Vigência: fim
        <input type="date" value={validTo} onChange={(e) => onChange({ validTo: e.target.value })} className={inputClass} />
      </label>
    </div>
  );
}

function RequestRenewalDialog({ item, onClose, onDone }: { item: AuthorizationItem; onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const suggested = suggestedRenewalPeriod(item.validFrom, item.expiresAt);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ sessions: String(item.authorizedHours), validFrom: suggested.validFrom, validTo: suggested.validTo });
  const [justification, setJustification] = useState(
    `Solicitamos a renovação da autorização de ${item.specialty} para ${item.patientName}, com continuidade do plano terapêutico em andamento.`,
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const remaining = item.authorizedHours - item.consumedHours;

  const submit = () => {
    const input = { sessions: Number(form.sessions), validFrom: form.validFrom, validTo: form.validTo };
    const invalid = validateRenewalPeriod(input);
    if (invalid) return setError(invalid);
    setError(null);
    startTransition(async () => {
      const result = await requestAuthorizationRenewal(item.id, input);
      if (!result.success) return setError(result.error);
      router.refresh();
      onDone();
    });
  };

  return (
    <DialogShell title="Pedir renovação da guia" step={`Passo ${step} de 2`} onClose={onClose}>
      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-md bg-paper p-4">
            <p className="m-0 text-base font-bold text-ink">{item.patientName}</p>
            <p className="m-0 mt-1 text-sm text-ink-soft">
              {item.insurerName} · {item.specialty} · guia {item.protocolNumber}
            </p>
          </div>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[15px]">
            <dt className="text-ink-soft">Sessões autorizadas</dt>
            <dd className="m-0 text-right font-semibold tabular-figure text-ink">{item.authorizedHours}</dd>
            <dt className="text-ink-soft">Sessões já usadas</dt>
            <dd className="m-0 text-right font-semibold tabular-figure text-ink">{item.consumedHours}</dd>
            <dt className="font-semibold text-ink">Saldo</dt>
            <dd className="m-0 text-right font-bold tabular-figure text-status-negative-text">{remaining}</dd>
            <dt className="text-ink-soft">Vale até</dt>
            <dd className="m-0 text-right font-semibold text-ink">{fmtDate(item.expiresAt)}</dd>
          </dl>
          <div className="flex justify-end gap-3 border-t border-paper-line pt-4">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancelar
            </button>
            <button type="button" onClick={() => setStep(2)} className="btn btn-primary">
              Continuar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <PeriodFields {...form} sessionsLabel="Sessões pedidas" onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
          <div className="flex flex-col gap-1">
            <label htmlFor="renewal-justification" className="text-sm font-semibold text-ink">
              Texto para o pedido ao plano
            </label>
            <textarea
              id="renewal-justification"
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full rounded-md border border-paper-line-strong bg-paper-surface p-3 text-[15px] text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-ink-soft">Não fica salvo aqui: copie e cole no portal ou e-mail do plano.</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(justification).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="btn btn-ghost shrink-0"
              >
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Copiado" : "Copiar texto"}
              </button>
            </div>
          </div>
          <p className="m-0 rounded-md bg-status-pending-soft px-4 py-3 text-sm text-status-pending-text">
            Isto registra que a clínica pediu a renovação. As sessões novas só entram quando você registrar a resposta do plano.
          </p>
          {error && (
            <p role="alert" className="m-0 text-sm font-semibold text-status-negative-text">
              {error}
            </p>
          )}
          <div className="flex justify-between gap-3 border-t border-paper-line pt-4">
            <button type="button" onClick={() => setStep(1)} className="btn btn-ghost" disabled={isPending}>
              Voltar
            </button>
            <button type="button" onClick={submit} className="btn btn-primary" disabled={isPending}>
              {isPending ? "Registrando…" : "Registrar pedido de renovação"}
            </button>
          </div>
        </div>
      )}
    </DialogShell>
  );
}

export function RenewalResponseDialog({
  item,
  onClose,
  onDone,
}: {
  item: Pick<AuthorizationItem, "patientName" | "insurerName" | "specialty"> & {
    renewal: NonNullable<AuthorizationItem["renewal"]>;
  };
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const renewal = item.renewal;
  const [outcome, setOutcome] = useState<"autorizada" | "negada">("autorizada");
  const [guideNumber, setGuideNumber] = useState("");
  const [form, setForm] = useState({ sessions: String(renewal.sessionsRequested), validFrom: renewal.validFrom, validTo: renewal.validTo });
  const [error, setError] = useState<string | null>(null);
  // Aviso pronto quando o navegador bloqueou a aba do WhatsApp: o diálogo fica aberto com o link.
  const [blocked, setBlocked] = useState<{ url: string; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const input =
      outcome === "negada"
        ? ({ outcome: "negada" } as const)
        : ({ outcome: "autorizada", guideNumber, sessions: Number(form.sessions), validFrom: form.validFrom, validTo: form.validTo } as const);
    if (input.outcome === "autorizada") {
      if (!guideNumber.trim()) return setError("Informe o número da guia autorizada.");
      const invalid = validateRenewalPeriod(input);
      if (invalid) return setError(invalid);
    }
    setError(null);
    // Aba aberta no clique (antes do await) para o navegador não tratar como pop-up.
    const whatsappWindow = input.outcome === "autorizada" ? preOpenWhatsappWindow() : null;
    startTransition(async () => {
      const result = await registerAuthorizationRenewalResponse(renewal.id, input);
      if (!result.success) {
        whatsappWindow?.close();
        return setError(result.error);
      }
      const opened = finishWhatsappWindow(whatsappWindow, result.whatsappUrl);
      router.refresh();
      const message = [outcome === "autorizada" ? "Guia nova registrada e ativa." : "Negativa do plano registrada.", result.note]
        .filter(Boolean)
        .join(" ");
      if (result.whatsappUrl && !opened) return setBlocked({ url: result.whatsappUrl, message });
      onDone(message);
    });
  };

  return (
    <DialogShell title="Resposta do plano" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-md bg-paper p-4">
          <p className="m-0 text-base font-bold text-ink">{item.patientName}</p>
          <p className="m-0 mt-1 text-sm text-ink-soft">
            {[item.insurerName, item.specialty].filter(Boolean).join(" · ")} · pedido{renewal.requestedAt ? ` em ${fmtDate(renewal.requestedAt)}` : ""} de{" "}
            {renewal.sessionsRequested} sessões
          </p>
        </div>

        <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold text-ink">O plano…</legend>
          {(["autorizada", "negada"] as const).map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[15px] font-semibold ${
                outcome === value ? "border-[var(--color-accent)] bg-[var(--color-accent-100)] text-ink" : "border-paper-line-strong text-ink-soft"
              }`}
            >
              <input type="radio" name="renewal-outcome" value={value} checked={outcome === value} onChange={() => setOutcome(value)} className="accent-[var(--color-accent)]" />
              {value === "autorizada" ? "Autorizado" : "Negado"}
            </label>
          ))}
        </fieldset>

        {outcome === "autorizada" ? (
          <>
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
              Número da guia autorizada
              <input value={guideNumber} onChange={(e) => setGuideNumber(e.target.value)} className={inputClass} autoComplete="off" />
            </label>
            <PeriodFields {...form} sessionsLabel="Sessões autorizadas" onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
          </>
        ) : (
          <p className="m-0 rounded-md bg-status-negative-soft px-4 py-3 text-sm text-status-negative-text">
            O pedido fica registrado como negado. O alerta de renovação continua na fila de pendências até entrar uma guia nova.
          </p>
        )}

        {error && (
          <p role="alert" className="m-0 text-sm font-semibold text-status-negative-text">
            {error}
          </p>
        )}
        {blocked ? (
          <div className="flex flex-col gap-3 border-t border-paper-line pt-4">
            <p className="m-0 text-sm text-ink">{blocked.message} O navegador bloqueou a aba do WhatsApp.</p>
            <div className="flex justify-end gap-3">
              <a href={blocked.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" onClick={() => onDone(blocked.message)}>
                Abrir WhatsApp com o aviso
              </a>
              <button type="button" onClick={() => onDone(blocked.message)} className="btn btn-ghost">
                Fechar sem avisar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-3 border-t border-paper-line pt-4">
            <button type="button" onClick={onClose} className="btn btn-ghost" disabled={isPending}>
              Cancelar
            </button>
            <button type="button" onClick={submit} className="btn btn-primary" disabled={isPending}>
              {isPending ? "Registrando…" : outcome === "autorizada" ? "Autorizado — salvar e avisar no WhatsApp" : "Registrar negativa"}
            </button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
