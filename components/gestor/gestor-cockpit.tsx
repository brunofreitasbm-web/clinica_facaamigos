"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/toast-provider";

export interface AlertItem {
  id: string;
  type: "critical" | "warning" | "success";
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  category: "Autorizações" | "Prontuários" | "Agenda" | "Financeiro";
}

export function GestorCockpit({ initialAlerts }: { initialAlerts: AlertItem[] }) {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAction = (alert: AlertItem) => {
    if (loadingId) return;
    setLoadingId(alert.id);
  };

  const handleDismiss = (alert: AlertItem) => {
    const { id } = alert;
    const index = alerts.findIndex((a) => a.id === id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast(
      `Alerta "${alert.title}" ignorado.`,
      "info",
      () => {
        setAlerts((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, alert);
          return next;
        });
      },
      5000
    );
  };

  return (
    <div className="flex flex-col gap-6 px-10 pt-6">
      {/* BANNER GUIA PASSO A PASSO "ANTI-BURRO" */}
      <div
        className="rounded-xl border p-5 shadow-sm transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%)",
          borderColor: "rgba(37, 99, 235, 0.2)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b pb-3" style={{ borderColor: "var(--color-divider)" }}>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-base shadow-sm">
              💡
            </span>
            <div>
              <h3 className="m-0 text-base font-bold text-ink tracking-tight">
                Central de Ações Guiadas do Gestor (Fluxo Anti-Erro)
              </h3>
              <p className="m-0 text-xs text-ink-soft">
                Selecione o fluxo desejado. O sistema verifica inconsistências e impede erros de agendamento, guias e repasses.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
            Modo Protegido Ativo
          </span>
        </div>

        {/* BOTOES DE FLUXO EXPLICATIVO */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/gestor/cadastros/pacientes"
            className="group flex flex-col justify-between rounded-lg border bg-surface p-4 no-underline transition-all hover:border-blue-500 hover:shadow-md"
            style={{ borderColor: "var(--color-divider)" }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Etapa 1 · Intake</span>
                <span className="text-lg">👤</span>
              </div>
              <h4 className="m-0 text-sm font-bold text-ink group-hover:text-blue-600">
                Novo Paciente
              </h4>
              <p className="mt-1 text-xs text-ink-soft line-clamp-2">
                Cadastro guiado de anamnese, laudo CID-10, responsáveis e prescrição de horas.
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-blue-600">
              Iniciar Onboarding →
            </div>
          </Link>

          <Link
            href="/gestor/cadastros/convenios"
            className="group flex flex-col justify-between rounded-lg border bg-surface p-4 no-underline transition-all hover:border-amber-500 hover:shadow-md"
            style={{ borderColor: "var(--color-divider)" }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Etapa 2 · Guia TISS</span>
                <span className="text-lg">📄</span>
              </div>
              <h4 className="m-0 text-sm font-bold text-ink group-hover:text-amber-600">
                Autorizações & Saldo
              </h4>
              <p className="mt-1 text-xs text-ink-soft line-clamp-2">
                Controle gráfico de horas autorizadas (ABA/Fono/TO) e renovação em 1 clique.
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-amber-600">
              Verificar Saldo →
            </div>
          </Link>

          <Link
            href="/gestor/cadastros/salas"
            className="group flex flex-col justify-between rounded-lg border bg-surface p-4 no-underline transition-all hover:border-emerald-500 hover:shadow-md"
            style={{ borderColor: "var(--color-divider)" }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Etapa 3 · Operação</span>
                <span className="text-lg">🏥</span>
              </div>
              <h4 className="m-0 text-sm font-bold text-ink group-hover:text-emerald-600">
                Salas & Evoluções
              </h4>
              <p className="mt-1 text-xs text-ink-soft line-clamp-2">
                Monitor em tempo real das salas, presenças e auditoria de evoluções em 24h.
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-emerald-600">
              Cockpit ao Vivo →
            </div>
          </Link>

          <Link
            href="/gestor/financeiro"
            className="group flex flex-col justify-between rounded-lg border bg-surface p-4 no-underline transition-all hover:border-purple-500 hover:shadow-md"
            style={{ borderColor: "var(--color-divider)" }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Etapa 4 · Fechamento</span>
                <span className="text-lg">💰</span>
              </div>
              <h4 className="m-0 text-sm font-bold text-ink group-hover:text-purple-600">
                Faturamento & Repasse
              </h4>
              <p className="mt-1 text-xs text-ink-soft line-clamp-2">
                Cálculo automatizado de repasses com trava de prontuários pendentes.
              </p>
            </div>
            <div className="mt-3 flex items-center text-xs font-semibold text-purple-600">
              Auditar Repasse →
            </div>
          </Link>
        </div>
      </div>

      {/* CENTRAL DE ALERTAS OPERACIONAIS */}
      <div className="rounded-xl border bg-surface p-6 shadow-sm" style={{ borderColor: "var(--color-divider)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="m-0 text-base font-bold text-ink">Alertas e Travas Operacionais Ativas</h3>
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
              {alerts.length} Requerem Atenção
            </span>
          </div>
          <span className="text-xs text-ink-faint">
            Atualizado automaticamente a cada atendimento
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg bg-emerald-50/30">
            <span className="text-3xl mb-2">✅</span>
            <h4 className="m-0 text-sm font-bold text-emerald-800">Nenhuma trava ou pendência crítica no momento!</h4>
            <p className="text-xs text-emerald-600 mt-1">Todas as autorizações, prontuários e agendas estão operando sem inconsistências.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.map((alert) => {
              const isCritical = alert.type === "critical";
              return (
                <div
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 transition-all"
                  style={{
                    backgroundColor: isCritical ? "rgba(239, 68, 68, 0.04)" : "rgba(245, 158, 11, 0.04)",
                    borderColor: isCritical ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.25)",
                  }}
                >
                  <div className="flex items-start gap-3 max-w-2xl">
                    <span className="text-xl">
                      {isCritical ? "🚨" : "⚠️"}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isCritical ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {alert.category}
                        </span>
                        <h4 className="m-0 text-sm font-bold text-ink">{alert.title}</h4>
                      </div>
                      <p className="m-0 text-xs text-ink-soft">{alert.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDismiss(alert)}
                      className="btn-ghost text-xs font-semibold rounded-md border-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      title="Ignorar alerta (pode ser desfeito por 5s)"
                      disabled={loadingId === alert.id}
                    >
                      Ignorar
                    </button>
                    <Link
                      href={alert.actionHref}
                      onClick={(e) => {
                        if (loadingId === alert.id) {
                          e.preventDefault();
                          return;
                        }
                        handleAction(alert);
                      }}
                      aria-disabled={loadingId === alert.id}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-md no-underline transition-all shadow-sm ${
                        loadingId === alert.id
                          ? "pointer-events-none opacity-70"
                          : ""
                      }`}
                      style={{ background: "var(--color-accent)", color: "var(--color-on-accent)" }}
                    >
                      {loadingId === alert.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Processando…
                        </>
                      ) : (
                        <>{alert.actionLabel} →</>
                      )}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
