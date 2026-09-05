"use client";

import { useState, type ReactNode } from "react";
import { PLAN_GOAL_STATUS_STYLE, BILLING_ITEM_STATUS_STYLE } from "@/lib/appointment-status-style";
import { AbaLearningCurveChart, type ProgramTrialSummary } from "./aba-learning-curve-chart";
import { ProtocolAssessmentDialog } from "./protocol-assessment-dialog";

const TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "evolucao", label: "Evolução" },
  { key: "aba", label: "Coleta ABA & Tentativas" },
  { key: "plano", label: "Plano terapêutico" },
  { key: "documentos", label: "Documentos" },
  { key: "financeiro", label: "Financeiro" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export type FrequencyDay = { id: string; colorVar: string; title: string };
export type GoalRow = {
  id: string;
  title: string;
  domain: string;
  criterion: string | null;
  status: string;
};
export type EvolutionNote = {
  id: string;
  date: string;
  version: number;
  therapistName: string;
  freeText: string | null;
};
export type BillingRow = {
  id: string;
  date: string;
  discipline: string;
  amount: number;
  status: string;
};

export function PatientTabs({
  frequency,
  goals,
  planStatusLabel,
  guardianText,
  authorizationText,
  teamText,
  notes,
  documentsContent,
  billing,
  abaPrograms,
}: {
  frequency: FrequencyDay[];
  goals: GoalRow[];
  planStatusLabel: string | null;
  guardianText: ReactNode;
  authorizationText: ReactNode;
  teamText: ReactNode;
  notes: EvolutionNote[];
  documentsContent: ReactNode;
  billing: BillingRow[];
  abaPrograms: ProgramTrialSummary[];
}) {
  const [tab, setTab] = useState<TabKey>("visao");

  return (
    <>
      <div className="px-10 pt-6">
        <div className="seg w-fit">
          {TABS.map((t) => (
            <label key={t.key} className="seg-opt">
              <input
                type="radio"
                name="patient-tab"
                checked={tab === t.key}
                onChange={() => setTab(t.key)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <main className="px-10 pb-16 pt-8">
        {tab === "visao" && (
          <section className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_340px]">
            <div className="flex flex-col gap-8">
              <div>
                <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
                  Frequência · últimas {frequency.length} sessões
                </h6>
                {frequency.length > 0 ? (
                  <div className="flex gap-[3px]">
                    {frequency.map((f) => (
                      <span
                        key={f.id}
                        title={f.title}
                        style={{ flex: 1, height: 24, borderRadius: 2, background: f.colorVar }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-faint">Nenhuma sessão registrada ainda.</p>
                )}
              </div>
              <div>
                <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
                  Plano ativo {planStatusLabel ? `· ${planStatusLabel}` : ""}
                </h6>
                <div className="flex flex-col">
                  {goals.length > 0 ? (
                    goals.map((g) => {
                      const style = PLAN_GOAL_STATUS_STYLE[g.status] ?? {
                        label: g.status,
                        tagClass: "st-cancelada",
                      };
                      return (
                        <div
                          key={g.id}
                          className="grid grid-cols-[1fr_auto] items-center gap-4 border-b py-3 text-sm"
                          style={{ borderColor: "color-mix(in srgb, var(--color-text) 8%, transparent)" }}
                        >
                          <span>{g.title}</span>
                          <span className={`tag-status ${style.tagClass}`}>{style.label}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-ink-faint">Sem plano terapêutico aprovado ainda.</p>
                  )}
                </div>
              </div>
            </div>
            <aside className="flex flex-col gap-6">
              <div>
                <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
                  Responsável
                </h6>
                <div className="text-sm">{guardianText}</div>
              </div>
              <div>
                <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
                  Autorização vigente
                </h6>
                <div className="text-sm">{authorizationText}</div>
              </div>
              <div>
                <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-3">
                  Equipe
                </h6>
                <div className="text-sm">{teamText}</div>
              </div>
            </aside>
          </section>
        )}

        {tab === "evolucao" && (
          <section className="max-w-[800px]">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-1.5">
              Append-only · nunca editada por cima
            </h6>
            <p className="mb-6 text-[13px] text-ink-soft">
              Cada linha é uma versão assinada em <code className="text-xs">session_notes</code>.
            </p>
            <div className="flex flex-col">
              {notes.length > 0 ? (
                notes.map((n) => (
                  <div
                    key={n.id}
                    className="grid grid-cols-[120px_1fr] gap-5 border-b py-4.5"
                    style={{ borderColor: "color-mix(in srgb, var(--color-text) 8%, transparent)" }}
                  >
                    <div>
                      <div style={{ fontFamily: "var(--font-heading)" }} className="text-[15px] font-semibold">
                        {n.date}
                      </div>
                      <div className="text-xs text-ink-faint">
                        v{n.version} · {n.therapistName}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm italic text-ink-soft">
                        {n.freeText ? `“${n.freeText}”` : "Sem texto livre nesta versão."}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-faint">Nenhuma evolução registrada ainda.</p>
              )}
            </div>
          </section>
        )}

        {tab === "plano" && (
          <section className="max-w-[900px]">
            <h6 style={{ color: "var(--color-accent-2-600)" }} className="mb-5">
              Plano terapêutico {planStatusLabel ? `· ${planStatusLabel}` : ""}
            </h6>
            <div className="flex flex-col">
              {goals.length > 0 ? (
                goals.map((g) => {
                  const style = PLAN_GOAL_STATUS_STYLE[g.status] ?? {
                    label: g.status,
                    tagClass: "st-cancelada",
                  };
                  return (
                    <div
                      key={g.id}
                      className="border-b py-4.5"
                      style={{ borderColor: "color-mix(in srgb, var(--color-text) 8%, transparent)" }}
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="text-[15px] font-semibold">{g.title}</span>
                        <span className={`tag-status ${style.tagClass}`}>{style.label}</span>
                      </div>
                      <div className="mt-1 text-[13px] text-ink-soft">
                        {g.domain}
                        {g.criterion ? ` · critério: ${g.criterion}` : ""}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-ink-faint">Sem plano terapêutico aprovado ainda.</p>
              )}
            </div>
          </section>
        )}

        {tab === "aba" && (
          <section className="max-w-[950px] space-y-6">
            <div className="flex justify-end">
              <ProtocolAssessmentDialog />
            </div>
            <AbaLearningCurveChart programsData={abaPrograms} />
          </section>
        )}

        {tab === "documentos" && <section className="max-w-[800px]">{documentsContent}</section>}

        {tab === "financeiro" && (
          <section className="max-w-[900px]">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Sessão</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {billing.length > 0 ? (
                  billing.map((b) => {
                    const style = BILLING_ITEM_STATUS_STYLE[b.status] ?? {
                      label: b.status,
                      tagClass: "st-cancelada",
                    };
                    return (
                      <tr key={b.id}>
                        <td>{b.date}</td>
                        <td>{b.discipline}</td>
                        <td>
                          R${" "}
                          {b.amount.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td>
                          <span className={`tag-status ${style.tagClass}`}>{style.label}</span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="text-ink-faint">
                      Nenhum lançamento ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </>
  );
}
