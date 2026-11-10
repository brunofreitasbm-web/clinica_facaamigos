"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { HelpHint } from "@/components/ui/help-hint";
import { formatReferenceMonth, OPEN_STATUSES, STATUS_LABEL, type PortalRobotMode } from "@/lib/portal-robot-pure";
import {
  cancelPortalRobot,
  confirmPortalRobot,
  getPortalRobotFormDefaults,
  getPortalRobotState,
  requestPortalRobot,
  type PortalRobotFormDefaults,
  type PortalRobotJobView,
  type PortalRobotState,
} from "./portal-robot-actions";

/**
 * Etapa 2 pelo robô (docs/portal-robot.md): pede o envio, acompanha o robô
 * preenchendo o portal do plano e mostra o resumo para a recepção confirmar —
 * sem sair do sistema. O botão manual "Guia enviada ao plano" continua ao lado.
 */

const PORTAL_STEPS = 6; // beneficiário, solicitante, solicitação, executante, anexo, resumo
const POLL_ACTIVE_MS = 3000;

function Btn({ children, onClick, disabled, primary }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50 ${
        primary ? "border-0 text-white" : "border border-paper-line-strong bg-paper text-ink hover:bg-paper-subtle"
      }`}
      style={primary ? { backgroundColor: "var(--color-accent)" } : undefined}
    >
      {children}
    </button>
  );
}

function SummaryList({ job }: { job: PortalRobotJobView }) {
  const p = job.payload;
  const portalName = typeof job.portalSummary?.beneficiary === "string" ? job.portalSummary.beneficiary : null;
  const providerGuide = typeof job.portalSummary?.provider_guide === "string" ? job.portalSummary.provider_guide : null;
  const rows: [string, string][] = [
    ["Beneficiário no portal", portalName ?? p.patient_name ?? "—"],
    ["Carteirinha", p.card_number],
    ["Médico", `${p.professional.name} · ${p.professional.council} ${p.professional.register}`],
    ["CID", p.cid],
    ["Terapias", p.procedures.map((t) => `${t.code} ×${t.quantity}`).join(", ")],
    ["Mês de referência", formatReferenceMonth(p.reference_month)],
    ["Laudo anexado", p.laudo.name],
  ];
  if (providerGuide) rows.push(["Nº guia prestador", providerGuide]);
  return (
    // Rótulo em cima do valor: a coluna da etapa 2 é estreita e duas colunas espremiam o texto.
    <dl className="m-0 flex flex-col text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="border-t border-paper-line-strong py-0.5 first:border-t-0">
          <dt className="text-[12px] text-ink-soft">{k}</dt>
          <dd className="m-0 font-semibold text-ink [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PortalRobotPanel({ draftId, canRequest }: { draftId: string; canRequest: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<PortalRobotState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastStatus = useRef<string | null>(null);

  const load = useCallback(async () => {
    const res = await getPortalRobotState(draftId);
    if (!res.success) return;
    setState(res.state);
    const status = res.state.job?.status ?? null;
    // Terminou agora (enviado → etapa 2 marcada no servidor): atualiza a linha do tempo inteira.
    if (lastStatus.current && status !== lastStatus.current && (status === "enviado" || status === "verificar")) router.refresh();
    lastStatus.current = status;
  }, [draftId, router]);

  const job = state?.job ?? null;
  const open = job ? OPEN_STATUSES.includes(job.status) : false;

  useEffect(() => {
    const first = setTimeout(load, 0);
    if (!open) return () => clearTimeout(first);
    const timer = setInterval(load, POLL_ACTIVE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load, open]);

  const act = (fn: () => Promise<{ success: true } | { success: false; error: string }>) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.success) setFeedback(res.error);
      await load();
    });
  };

  if (!state) return null;
  // Guia marcada à mão (sem pedido ao robô): nada a mostrar, o cartão já diz quem enviou.
  if (!canRequest && !job) return null;
  const online = state.agentOnline;

  return (
    <div className="flex flex-col gap-2 border-t border-paper-line-strong pt-2">
      <p className="m-0 flex items-center gap-1.5 text-[12px] text-ink-soft">
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-2 rounded-full ${online ? "bg-status-positive-text" : "bg-status-neutral"}`}
        />
        {online ? "Robô do portal ligado" : "Robô do portal desligado"}
        <HelpHint
          text="O robô roda num computador da clínica. Ele preenche o portal do plano, anexa o laudo e para no resumo para você confirmar aqui."
          label="Ajuda: robô do portal"
        />
      </p>

      {job && open && (
        <div role="status" className="flex flex-col gap-1.5 rounded-md border border-paper-line-strong bg-white px-2.5 py-2">
          <p className="m-0 text-[13px] font-semibold text-ink">
            {STATUS_LABEL[job.status]}
            {job.mode === "simular" ? " · simulação" : ""}
          </p>
          {job.status === "na_fila" && !online && (
            <p className="m-0 text-[12px] text-status-pending-text">O computador do robô parece desligado — o pedido espera na fila.</p>
          )}
          {(job.status === "em_andamento" || job.status === "confirmado") && (
            <>
              <div className="flex gap-1" aria-hidden="true">
                {Array.from({ length: PORTAL_STEPS }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${i + 1 < job.step ? "bg-status-positive-text" : i + 1 === job.step ? "bg-[var(--color-accent)]" : "bg-paper-line-strong"}`}
                  />
                ))}
              </div>
              {job.stepLabel && <p className="m-0 text-[12px] text-ink-soft">{job.stepLabel}</p>}
            </>
          )}
          {job.status === "aguardando_confirmacao" && (
            <>
              <p className="m-0 text-[12px] text-ink-soft">
                O robô preencheu tudo e parou no resumo do portal. Confira os dados abaixo
                {job.screenshotUrl ? " e o print" : ""} antes de enviar ao plano.
              </p>
              <SummaryList job={job} />
              {job.screenshotUrl && (
                <a href={job.screenshotUrl} target="_blank" rel="noreferrer" className="text-[12px] underline">
                  Ver print do resumo no portal
                </a>
              )}
              <div className="flex flex-wrap gap-2">
                <Btn primary onClick={() => act(() => confirmPortalRobot(job.id))} disabled={isPending}>
                  Confirmar envio ao plano
                </Btn>
                <Btn onClick={() => act(() => cancelPortalRobot(job.id))} disabled={isPending}>
                  Cancelar
                </Btn>
              </div>
            </>
          )}
          {(job.status === "na_fila" || job.status === "em_andamento") && (
            <div>
              <Btn onClick={() => act(() => cancelPortalRobot(job.id))} disabled={isPending}>
                Cancelar pedido
              </Btn>
            </div>
          )}
        </div>
      )}

      {job && !open && job.status !== "cancelado" && (
        <div
          className={`flex flex-col gap-1 rounded-md border px-2.5 py-2 text-[13px] ${
            job.status === "enviado"
              ? "border-status-positive-text/40 bg-status-positive-text/5"
              : job.status === "simulado"
                ? "border-paper-line-strong bg-paper"
                : "border-status-negative-text/40 bg-status-negative-text/5"
          }`}
        >
          <p
            className={`m-0 font-semibold ${
              job.status === "enviado" ? "text-status-positive-text" : job.status === "simulado" ? "text-ink" : "text-status-negative-text"
            }`}
          >
            {STATUS_LABEL[job.status]}
            {job.finishedAt ? ` · ${fmtDateTime(job.finishedAt, CLINIC_TIMEZONE)}` : ""}
          </p>
          {job.result?.portal_status && <p className="m-0 text-ink">Portal: {job.result.portal_status}</p>}
          {job.result?.guide_number && <p className="m-0 text-ink">Nº guia prestador: {job.result.guide_number}</p>}
          {job.status === "verificar" && (
            <p className="m-0 text-ink">O robô clicou em Autorizar mas não leu a resposta. Confira no portal antes de enviar de novo.</p>
          )}
          {job.error && job.status !== "verificar" && <p className="m-0 text-ink">{job.error}</p>}
          {job.screenshotUrl && (
            <a href={job.screenshotUrl} target="_blank" rel="noreferrer" className="text-[12px] underline">
              Ver print da tela do portal
            </a>
          )}
        </div>
      )}

      {canRequest && !open && (
        <div>
          <Btn onClick={() => setShowForm(true)} disabled={isPending}>
            {job && (job.status === "erro" || job.status === "simulado") ? "Enviar pelo robô de novo" : "Enviar pelo robô"}
          </Btn>
        </div>
      )}

      {feedback && (
        <p role="alert" className="m-0 text-[13px] text-status-negative-text">
          {feedback}
        </p>
      )}

      {showForm && (
        <PortalRobotRequestDialog
          draftId={draftId}
          onClose={() => setShowForm(false)}
          onSent={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

type ProcRow = { code: string; description: string; quantity: string };

export function PortalRobotRequestDialog({ draftId, onClose, onSent }: { draftId: string; onClose: () => void; onSent: () => void }) {
  const [defaults, setDefaults] = useState<PortalRobotFormDefaults | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<PortalRobotMode>("autorizar");
  const [card, setCard] = useState("");
  const [cid, setCid] = useState("");
  const [month, setMonth] = useState("");
  const [observation, setObservation] = useState("");
  const [profId, setProfId] = useState<string>("novo");
  const [prof, setProf] = useState({ name: "", council: "CRM", register: "", uf: "PA", cbo: "" });
  const [procs, setProcs] = useState<ProcRow[]>([{ code: "", description: "", quantity: "1" }]);
  const [fileId, setFileId] = useState("");

  useEffect(() => {
    let alive = true;
    getPortalRobotFormDefaults(draftId).then((res) => {
      if (!alive) return;
      if (!res.success) {
        setLoadError(res.error);
        return;
      }
      const d = res.defaults;
      setDefaults(d);
      const prev = d.previous;
      setCard(prev?.card_number ?? d.cardNumber);
      setCid(prev?.cid ?? d.cid);
      setMonth(d.referenceMonth);
      setFileId(prev?.laudo.file_id && d.files.some((f) => f.id === prev.laudo.file_id) ? prev.laudo.file_id : (d.suggestedFileId ?? ""));
      if (prev) {
        setProcs(prev.procedures.map((p) => ({ code: p.code, description: p.description, quantity: String(p.quantity) })));
        const saved = d.professionals.find((p) => p.council === prev.professional.council && p.register === prev.professional.register);
        setProfId(saved?.id ?? "novo");
        setProf({ ...prev.professional });
      } else if (d.professionals.length === 1) {
        setProfId(d.professionals[0].id);
        setProf({ ...d.professionals[0] });
      }
    });
    return () => {
      alive = false;
    };
  }, [draftId]);

  const pickProfessional = (id: string) => {
    setProfId(id);
    const saved = defaults?.professionals.find((p) => p.id === id);
    setProf(saved ? { name: saved.name, council: saved.council, register: saved.register, uf: saved.uf ?? "", cbo: saved.cbo } : { name: "", council: "CRM", register: "", uf: "PA", cbo: "" });
  };

  const setProc = (i: number, patch: Partial<ProcRow>) => setProcs((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestPortalRobot(draftId, {
        mode,
        cardNumber: card,
        cid,
        referenceMonth: month,
        observation,
        professional: prof,
        procedures: procs,
        laudoFileId: fileId,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSent();
    });
  };

  const editingProf = profId === "novo";

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Enviar guia ao plano pelo robô"
        className="flex max-h-[90vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-lg border border-paper-line-strong bg-paper p-5 shadow-xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-base font-semibold text-ink">Enviar guia ao plano pelo robô</h2>
            <p className="m-0 mt-0.5 text-[13px] text-ink-soft">
              {defaults?.patientName ?? "Contato"} · o robô preenche o portal e para no resumo para você confirmar.
            </p>
          </div>
          <button type="button" onClick={onClose} className="border-0 bg-transparent text-xl text-ink-soft" aria-label="Fechar">
            ×
          </button>
        </header>

        {loadError && <p className="m-0 text-sm text-status-negative-text">{loadError}</p>}
        {!defaults && !loadError && <p className="m-0 text-sm text-ink-soft">Carregando…</p>}

        {defaults && (
          <>
            <fieldset className="m-0 flex flex-wrap gap-3 border-0 p-0 text-[13px] text-ink">
              <legend className="sr-only">Modo</legend>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="robot-mode" checked={mode === "autorizar"} onChange={() => setMode("autorizar")} />
                Enviar ao plano (com confirmação)
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="robot-mode" checked={mode === "simular"} onChange={() => setMode("simular")} />
                Só simular (preenche e para, nada é enviado)
              </label>
            </fieldset>

            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                Carteirinha
                <input value={card} onChange={(e) => setCard(e.target.value)} inputMode="numeric" className="input" />
              </label>
              <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                CID (CID-10)
                <input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="F84.0" className="input" />
              </label>
              <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                Mês de referência
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input" />
              </label>
            </div>

            <fieldset className="m-0 flex flex-col gap-2 rounded-md border border-paper-line-strong p-3">
              <legend className="px-1 text-[13px] font-semibold text-ink">Médico solicitante (quem assina o laudo)</legend>
              <select value={profId} onChange={(e) => pickProfessional(e.target.value)} className="input" aria-label="Médico solicitante">
                {defaults.professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.council} {p.register}
                  </option>
                ))}
                <option value="novo">+ Outro médico (preencher)</option>
              </select>
              {editingProf && (
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                  <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft sm:col-span-3">
                    Nome
                    <input value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} className="input" />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                    Conselho
                    <input value={prof.council} onChange={(e) => setProf({ ...prof, council: e.target.value })} className="input" />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                    Nº registro
                    <input value={prof.register} onChange={(e) => setProf({ ...prof, register: e.target.value })} inputMode="numeric" className="input" />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                    UF
                    <input value={prof.uf} maxLength={2} onChange={(e) => setProf({ ...prof, uf: e.target.value })} className="input" />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                    CBO
                    <input value={prof.cbo} onChange={(e) => setProf({ ...prof, cbo: e.target.value })} placeholder="225112" inputMode="numeric" className="input" />
                  </label>
                </div>
              )}
            </fieldset>

            <fieldset className="m-0 flex flex-col gap-2 rounded-md border border-paper-line-strong p-3">
              <legend className="px-1 text-[13px] font-semibold text-ink">Terapias (código do convênio)</legend>
              {procs.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_2fr_70px_auto] items-end gap-2">
                  <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                    Código
                    <input value={p.code} onChange={(e) => setProc(i, { code: e.target.value })} inputMode="numeric" className="input" />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                    Descrição
                    <input value={p.description} onChange={(e) => setProc(i, { description: e.target.value })} className="input" />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
                    Qtde.
                    <input type="number" min={1} value={p.quantity} onChange={(e) => setProc(i, { quantity: e.target.value })} className="input" />
                  </label>
                  <button
                    type="button"
                    onClick={() => setProcs((rows) => (rows.length > 1 ? rows.filter((_, j) => j !== i) : rows))}
                    className="mb-1 border-0 bg-transparent text-lg text-ink-soft"
                    aria-label="Remover terapia"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div>
                <Btn onClick={() => setProcs((rows) => [...rows, { code: "", description: "", quantity: "1" }])}>+ Terapia</Btn>
              </div>
            </fieldset>

            <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
              Laudo / pedido médico a anexar
              <select value={fileId} onChange={(e) => setFileId(e.target.value)} className="input">
                <option value="">Escolha o arquivo</option>
                {defaults.files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.detectedType ? ` (${f.detectedType.replace("_", " ")})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-0.5 text-[13px] text-ink-soft">
              Observação/justificativa no portal (opcional)
              <input value={observation} onChange={(e) => setObservation(e.target.value)} className="input" />
            </label>
          </>
        )}

        {error && (
          <p role="alert" className="m-0 text-sm text-status-negative-text">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Btn onClick={onClose} disabled={isPending}>
            Cancelar
          </Btn>
          <Btn primary onClick={submit} disabled={isPending || !defaults}>
            {isPending ? "Enviando…" : mode === "simular" ? "Simular no portal" : "Colocar na fila do robô"}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
