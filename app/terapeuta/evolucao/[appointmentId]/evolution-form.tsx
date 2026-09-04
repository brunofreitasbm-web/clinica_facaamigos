"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createSessionNote } from "../actions";
import {
  BEHAVIOR_TYPES,
  BEHAVIOR_INTENSITIES,
  FAMILY_GUIDANCE_OPTIONS,
} from "@/lib/session-note-fields";

const PRESENCE_SCALE = [1, 2, 3, 4, 5] as const;

// Duas etapas reais (presença/comportamentos → texto livre + assinatura).
// O mock "Evolução em 2 min" tem uma 3ª etapa de coleta de tentativas por
// programa (ABA), mas isso depende de `programs`/`trial_data`, que existem
// no schema (lib/database.types.ts) porém não têm nenhuma consulta ou tela
// no app hoje — não dá pra inventar essa feature aqui, então a coleta de
// tentativas fica de fora e o wizard começa direto no que já está gravado
// em `session_notes.structured`.

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function EvolutionForm({
  appointmentId,
  patientName,
  discipline,
  sessionTime,
  attendanceStartedAt,
}: {
  appointmentId: string;
  patientName: string;
  discipline: string;
  sessionTime: string;
  attendanceStartedAt: string | null;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [signed, setSigned] = useState(false);
  const [presence, setPresence] = useState<number | null>(null);
  const [selectedBehaviors, setSelectedBehaviors] = useState<Record<string, boolean>>({});
  const [intensities, setIntensities] = useState<Record<string, string>>({});
  const [selectedOrientations, setSelectedOrientations] = useState<Record<string, boolean>>({});
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [elapsedSec, setElapsedSec] = useState(0);
  const [draftSaved, setDraftSaved] = useState(false);

  // Restaura rascunho salvo do localStorage se existir
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`draft_evolution_${appointmentId}`);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.presence) setPresence(data.presence);
        if (data.freeText) setFreeText(data.freeText);
        if (data.selectedBehaviors) setSelectedBehaviors(data.selectedBehaviors);
        if (data.selectedOrientations) setSelectedOrientations(data.selectedOrientations);
      }
    } catch {}
  }, [appointmentId]);

  // Salva alterações no localStorage
  useEffect(() => {
    if (signed) {
      localStorage.removeItem(`draft_evolution_${appointmentId}`);
      return;
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          `draft_evolution_${appointmentId}`,
          JSON.stringify({ presence, freeText, selectedBehaviors, selectedOrientations })
        );
        setDraftSaved(true);
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [presence, freeText, selectedBehaviors, selectedOrientations, appointmentId, signed]);

  useEffect(() => {
    if (!attendanceStartedAt) return;
    const compute = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - new Date(attendanceStartedAt).getTime()) / 1000)));
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [attendanceStartedAt]);

  function toggleBehavior(value: string) {
    setSelectedBehaviors((prev) => ({ ...prev, [value]: !prev[value] }));
    setIntensities((prev) => (prev[value] ? prev : { ...prev, [value]: "leve" }));
  }

  function toggleOrientation(value: string) {
    setSelectedOrientations((prev) => ({ ...prev, [value]: !prev[value] }));
  }

  function goToStep2() {
    if (presence === null) {
      setStepError("Selecione a presença/engajamento (1 a 5).");
      return;
    }
    setStepError(null);
    setStep(2);
  }

  const behaviorCount = Object.values(selectedBehaviors).filter(Boolean).length;
  const orientationCount = Object.values(selectedOrientations).filter(Boolean).length;

  const stepBg = (n: 1 | 2) =>
    step >= n || signed ? "var(--color-accent-2)" : "color-mix(in srgb, #fff 25%, transparent)";

  return (
    <>
      <header
        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        className="flex flex-col gap-2.5 px-5 pb-4 pt-7 sm:px-10"
      >
        <div className="flex items-center justify-between text-[13px]">
          <Link href="/terapeuta" className="no-underline opacity-80" style={{ color: "inherit" }}>
            ← Hoje
          </Link>
          {!signed && (
            <div className="flex items-center gap-3 text-xs opacity-90">
              {draftSaved && (
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Rascunho salvo localmente
                </span>
              )}
              <span className="flex items-center gap-2 tabular-nums opacity-90">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--color-accent-2)" }} />
                {attendanceStartedAt ? formatElapsed(elapsedSec) : "—:—"}
              </span>
            </div>
          )}
        </div>
        <div>
          <div className="text-xs opacity-70">
            Evolução · {patientName} · {discipline} · {sessionTime}
          </div>
          <h1
            style={{ fontFamily: "var(--font-heading)" }}
            className="m-0 text-2xl font-semibold leading-tight text-inherit"
          >
            {signed ? "Evolução assinada" : "Versão 1"}
          </h1>
        </div>
        {!signed && (
          <div className="mt-1 flex gap-1">
            {[1, 2].map((n) => (
              <span
                key={n}
                className="h-[3px] flex-1 rounded-sm"
                style={{ background: stepBg(n as 1 | 2) }}
              />
            ))}
          </div>
        )}
      </header>

      {signed ? (
        <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center gap-4 px-5 py-16 text-center sm:px-10">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{ background: "var(--status-realizada-bg)", color: "var(--status-realizada)" }}
            aria-hidden
          >
            ✓
          </span>
          <p className="text-lg font-semibold text-ink">Evolução assinada</p>
          <p className="text-sm text-ink-soft">
            Versão 1 registrada para {patientName}. O registro é append-only — não pode ser editado por cima.
          </p>
          <Link href="/terapeuta" className="btn btn-primary mt-2">
            Voltar para Hoje
          </Link>
        </div>
      ) : (
        <form
          className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-5 pb-28 pt-6 sm:px-10 sm:pb-10"
          action={(formData) => {
            setError(null);
            formData.set("created_at_device", new Date().toISOString());
            if (presence !== null) {
              formData.set("presenca_engajamento", String(presence));
            }
            startTransition(async () => {
              const result = await createSessionNote(appointmentId, formData);
              if (!result.success) {
                setError(result.error);
                return;
              }
              setSigned(true);
            });
          }}
        >
          {/* Passo 1 — presença/engajamento e comportamentos-alvo, campos de
              lib/session-note-fields.ts já gravados em session_notes.structured. */}
          <div className={step === 1 ? "flex flex-col gap-6" : "hidden"}>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                Presença e engajamento
              </p>
              <div className="mt-2 flex gap-2">
                {PRESENCE_SCALE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setPresence(n);
                      setStepError(null);
                    }}
                    className="flex-1 font-semibold"
                    style={{
                      minHeight: 48,
                      borderRadius: "var(--radius-md)",
                      fontFamily: "var(--font-heading)",
                      fontSize: 16,
                      border: `1px solid ${presence === n ? "var(--color-accent)" : "var(--color-divider)"}`,
                      background: presence === n ? "var(--color-accent)" : "var(--color-surface)",
                      color: presence === n ? "#fff" : "var(--color-text)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                Comportamentos-alvo observados
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {BEHAVIOR_TYPES.map((b) => (
                  <div key={b.value} className="flex flex-wrap items-center gap-2.5">
                    <label
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                      style={{
                        borderRadius: "var(--radius-md)",
                        border: `1px solid ${selectedBehaviors[b.value] ? "var(--color-accent)" : "var(--color-divider)"}`,
                        background: selectedBehaviors[b.value] ? "var(--color-accent-100)" : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        name="comportamento_tipo"
                        value={b.value}
                        checked={!!selectedBehaviors[b.value]}
                        onChange={() => toggleBehavior(b.value)}
                        className="sr-only"
                      />
                      {b.label}
                    </label>
                    {selectedBehaviors[b.value] && (
                      <div className="seg">
                        {BEHAVIOR_INTENSITIES.map((i) => (
                          <label key={i.value} className="seg-opt">
                            <input
                              type="radio"
                              name={`comportamento_intensidade_${b.value}`}
                              value={i.value}
                              checked={intensities[b.value] === i.value}
                              onChange={() => setIntensities((prev) => ({ ...prev, [b.value]: i.value }))}
                            />
                            {i.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                Orientação dada à família
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FAMILY_GUIDANCE_OPTIONS.map((g) => (
                  <label
                    key={g.value}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                    style={{
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${selectedOrientations[g.value] ? "var(--color-accent-2)" : "var(--color-divider)"}`,
                      background: selectedOrientations[g.value] ? "var(--color-accent-2-100)" : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="orientacao"
                      value={g.value}
                      checked={!!selectedOrientations[g.value]}
                      onChange={() => toggleOrientation(g.value)}
                      className="sr-only"
                    />
                    {g.label}
                  </label>
                ))}
              </div>
            </div>

            {stepError && <p className="text-xs text-status-negative-text">{stepError}</p>}
          </div>

          {/* Passo 2 — texto livre + resumo antes de assinar. */}
          <div className={step === 2 ? "flex flex-col gap-6" : "hidden"}>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-ink-soft" htmlFor="free_text">
                Texto livre (opcional)
              </label>
              <textarea
                id="free_text"
                name="free_text"
                rows={4}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                className="input mt-2"
              />
            </div>

            <div className="card">
              <div className="card-kicker">Resumo antes de assinar</div>
              <div className="flex flex-col gap-1 text-sm text-ink">
                <span>Presença/engajamento: {presence ?? "—"}/5</span>
                <span>
                  Comportamentos-alvo: {behaviorCount > 0 ? behaviorCount : "nenhum registrado"}
                </span>
                <span>
                  Orientações à família: {orientationCount > 0 ? orientationCount : "nenhuma registrada"}
                </span>
                <span>Versão: 1</span>
              </div>
            </div>

            {error && <p className="text-xs text-status-negative-text">{error}</p>}
          </div>

          <div
            className="fixed inset-x-0 bottom-0 z-10 flex gap-2.5 bg-white px-5 pb-7 pt-3 sm:px-10"
            style={{ borderTop: "1px solid var(--color-divider)" }}
          >
            {step === 2 && (
              <button type="button" className="btn btn-secondary" style={{ minHeight: 48 }} onClick={() => setStep(1)}>
                Voltar
              </button>
            )}
            {step === 1 ? (
              <button
                type="button"
                className="btn btn-primary flex-1"
                style={{ minHeight: 48, fontSize: 15 }}
                onClick={goToStep2}
              >
                Continuar
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-gold flex-1"
                style={{ minHeight: 48, fontSize: 15 }}
                disabled={isPending}
              >
                {isPending ? "Assinando…" : "Assinar evolução"}
              </button>
            )}
          </div>
        </form>
      )}
    </>
  );
}
