"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { PLAN_GOAL_STATUS_STYLE, BILLING_ITEM_STATUS_STYLE } from "@/lib/appointment-status-style";
import { fmtCurrency } from "@/lib/format";
import type { SessionNoteStructured } from "@/lib/session-note-fields";
import type { BehaviorCatalogItem } from "@/lib/behavior-catalog";
import { AbaLearningCurveChart, type ProgramTrialSummary } from "./aba-learning-curve-chart";
import { ProtocolAssessmentDialog } from "./protocol-assessment-dialog";
import { SessionNoteStructuredView } from "./session-note-structured";
import { NotifyMissingPtsButton } from "./notify-missing-pts-button";

const BASE_TABS = [
  { key: "visao", label: "Visão geral" },
  { key: "evolucao", label: "Evolução" },
  { key: "aba", label: "Coleta ABA & Tentativas" },
  { key: "plano", label: "Plano terapêutico" },
  { key: "documentos", label: "Documentos" },
] as const;

const AGENDA_TAB = { key: "agenda", label: "Agenda" } as const;
const FINANCEIRO_TAB = { key: "financeiro", label: "Financeiro" } as const;

type TabKey =
  | (typeof BASE_TABS)[number]["key"]
  | typeof AGENDA_TAB.key
  | typeof FINANCEIRO_TAB.key;

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
  structured?: SessionNoteStructured | null;
  appointmentId?: string;
  href?: string;
  historyHref?: string;
};
export type BillingRow = {
  id: string;
  date: string;
  discipline: string;
  amount: number;
  status: string;
};
export type PendingEvolution = { id: string; date: string; discipline: string };

export function PatientTabs({
  frequency,
  goals,
  planStatusLabel,
  guardianText,
  authorizationText,
  teamText,
  notes,
  pendingEvolutions,
  documentsContent,
  billing,
  abaPrograms,
  agendaContent,
  behaviorCatalog,
  goalDescriptionById,
  paddingClassName = "px-10",
  patientId,
  initialHasPendingPtsNotice = false,
}: {
  frequency: FrequencyDay[];
  goals: GoalRow[];
  planStatusLabel: string | null;
  guardianText: ReactNode;
  authorizationText: ReactNode;
  teamText: ReactNode;
  notes: EvolutionNote[];
  /** Sessões já realizadas deste terapeuta com este paciente que ainda não têm evolução — entrada direta pra gravar por voz. */
  pendingEvolutions?: PendingEvolution[];
  documentsContent: ReactNode;
  /** Ausente para papéis que não veem valores de convênio (PRD §4). */
  billing?: BillingRow[];
  abaPrograms: ProgramTrialSummary[];
  agendaContent?: ReactNode;
  behaviorCatalog?: BehaviorCatalogItem[];
  goalDescriptionById?: Map<string, string>;
  paddingClassName?: string;
  patientId?: string;
  initialHasPendingPtsNotice?: boolean;
}) {
  const tabs = [
    ...BASE_TABS,
    ...(agendaContent ? [AGENDA_TAB] : []),
    ...(billing ? [FINANCEIRO_TAB] : []),
  ];
  const [tab, setTab] = useState<TabKey>("visao");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(notes[0]?.id ?? null);
  const [noteSearch, setNoteSearch] = useState("");

  const filteredNotes = notes.filter(
    (n) =>
      !noteSearch ||
      n.date.toLowerCase().includes(noteSearch.toLowerCase()) ||
      n.therapistName.toLowerCase().includes(noteSearch.toLowerCase())
  );
  const activeNote = notes.find((n) => n.id === selectedNoteId) ?? filteredNotes[0] ?? notes[0];

  return (
    <>
      <div className={`${paddingClassName} pt-4`}>
        <div className="seg w-fit flex-wrap">
          {tabs.map((t) => (
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

      <main className={`${paddingClassName} pb-16 pt-6`}>
        {tab === "visao" && (
          <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
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
                    <div>
                      <p className="text-sm text-ink-faint">Sem plano terapêutico aprovado ainda.</p>
                      <NotifyMissingPtsButton patientId={patientId} initialHasNotice={initialHasPendingPtsNotice} />
                    </div>
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
          <section className="w-full">
            {pendingEvolutions && pendingEvolutions.length > 0 && (
              <div
                className="mb-6 rounded-xl border p-4 shadow-xs"
                style={{ borderColor: "var(--status-agendada)", background: "var(--status-agendada-bg)" }}
              >
                <div className="flex items-center justify-between">
                  <h6 style={{ color: "var(--color-accent-2-600)" }} className="font-semibold text-sm">
                    ⚡ {pendingEvolutions.length} {pendingEvolutions.length === 1 ? "sessão aguardando" : "sessões aguardando"} evolução
                  </h6>
                </div>
                <p className="mb-3 text-[13px] text-ink-soft">
                  Grave um relato curto por voz (~30s) e a IA pré-preenche presença, comportamentos e orientações.
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingEvolutions.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-paper-line bg-paper p-3 text-sm shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{p.date}</p>
                        <p className="truncate text-xs text-ink-faint">{p.discipline}</p>
                      </div>
                      <Link href={`/terapeuta/evolucao/${p.id}`} className="btn btn-gold shrink-0 px-3 py-1.5 text-xs">
                        🎤 Registrar
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notes.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Master Pane: Lista de Histórico */}
                <div className="flex flex-col gap-3 lg:col-span-4 xl:col-span-4">
                  <div className="flex items-center justify-between border-b border-paper-line pb-2">
                    <div>
                      <h6 style={{ color: "var(--color-accent-2-600)" }} className="font-semibold text-sm">
                        Histórico ({filteredNotes.length})
                      </h6>
                      <span className="text-[11px] text-ink-faint">Append-only · assinado</span>
                    </div>
                  </div>

                  {notes.length > 3 && (
                    <input
                      type="text"
                      placeholder="Filtrar por data ou terapeuta..."
                      value={noteSearch}
                      onChange={(e) => setNoteSearch(e.target.value)}
                      className="w-full rounded-lg border border-paper-line-strong bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent-1 focus:outline-none"
                    />
                  )}

                  <div className="flex max-h-[650px] flex-col gap-2 overflow-y-auto pr-1">
                    {filteredNotes.map((n) => {
                      const isSelected = activeNote?.id === n.id;
                      return (
                        <button
                          type="button"
                          key={n.id}
                          onClick={() => setSelectedNoteId(n.id)}
                          className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-all ${
                            isSelected
                              ? "border-accent-1 bg-accent-1/10 shadow-xs ring-1 ring-accent-1"
                              : "border-paper-line bg-paper hover:border-paper-line-strong hover:bg-paper-surface"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-ink">{n.date}</span>
                            <span className="rounded-full bg-paper-surface px-2 py-0.5 text-[10px] font-semibold text-ink-faint">
                              v{n.version}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-ink-soft">
                            <span className="truncate">{n.therapistName}</span>
                            {isSelected && <span className="text-[11px] font-bold text-accent-1">Selecionado →</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Detail Pane: Visualização da Nota Estruturada Selecionada */}
                <div className="lg:col-span-8 xl:col-span-8">
                  {activeNote ? (
                    <div className="sticky top-6 rounded-xl border border-paper-line-strong bg-paper p-6 shadow-xs">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-paper-line pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-bold text-ink">{activeNote.date}</h4>
                            <span className="rounded-full bg-accent-1/20 px-2.5 py-0.5 text-xs font-semibold text-accent-1-text">
                              v{activeNote.version}
                            </span>
                          </div>
                          <p className="text-xs text-ink-soft">
                            Profissional responsável: <span className="font-semibold text-ink">{activeNote.therapistName}</span>
                          </p>
                        </div>
                        {activeNote.historyHref && (
                          <Link href={activeNote.historyHref} className="text-xs text-chart hover:underline">
                            Ver histórico completo
                          </Link>
                        )}
                      </div>

                      {behaviorCatalog ? (
                        <SessionNoteStructuredView
                          structured={activeNote.structured ?? null}
                          freeText={activeNote.freeText}
                          behaviorCatalog={behaviorCatalog}
                          goalDescriptionById={goalDescriptionById}
                          version={activeNote.version}
                          historyHref={activeNote.historyHref}
                        />
                      ) : (
                        <div className="rounded-lg bg-paper-surface p-4 text-sm italic text-ink-soft">
                          {activeNote.freeText ? `“${activeNote.freeText}”` : "Sem texto livre nesta versão."}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-paper-line p-6 text-sm text-ink-faint">
                      Selecione uma sessão no painel ao lado para visualizar.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-ink-faint">Nenhuma evolução registrada ainda.</p>
            )}
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
                <div>
                  <p className="text-sm text-ink-faint">Sem plano terapêutico aprovado ainda.</p>
                  <NotifyMissingPtsButton patientId={patientId} initialHasNotice={initialHasPendingPtsNotice} />
                </div>
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

        {tab === "agenda" && <section className="max-w-[800px]">{agendaContent}</section>}

        {tab === "financeiro" && billing && (
          <section className="max-w-[900px] overflow-x-auto">
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
                        <td>{fmtCurrency(b.amount)}</td>
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
