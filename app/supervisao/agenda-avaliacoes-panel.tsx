"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { useSupervisaoTab } from "./supervisao-shell";
import type { EvaluationAgendaItem, EvaluationAgendaOrigin } from "@/lib/evaluation-agenda";

/**
 * Aba "Agenda 1ª Avaliação" do painel de coordenação — visão única, agregada
 * das três origens possíveis de um paciente novo (WhatsApp/anamnese, PDF de
 * convênio, presencial pela Recepção), pra o supervisor enxergar o funil
 * completo de 1ª avaliação/anamnese/acolhimento sem abrir três telas.
 *
 * Não duplica a lógica de aprovação — cada linha com fila própria (WhatsApp
 * anamnese/convênio) só navega até a aba onde a ação de fato acontece.
 */

const ORIGIN_LABEL: Record<EvaluationAgendaOrigin, string> = {
  whatsapp_anamnese: "WhatsApp · Anamnese",
  convenio_pdf: "PDF de convênio",
  presencial: "Presencial",
};

const ORIGIN_TAG: Record<EvaluationAgendaOrigin, string> = {
  whatsapp_anamnese: "st-agendada",
  convenio_pdf: "st-confirmada",
  presencial: "st-realizada",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgendaAvaliacoesPanel({ items }: { items: EvaluationAgendaItem[] }) {
  const { setTab } = useSupervisaoTab();
  const [originFilter, setOriginFilter] = useState<"all" | EvaluationAgendaOrigin>("all");

  const filtered = useMemo(
    () => (originFilter === "all" ? items : items.filter((i) => i.origin === originFilter)),
    [items, originFilter],
  );

  const aguardando = filtered.filter((i) => i.phase === "aguardando");
  const agendado = filtered.filter((i) => i.phase === "agendado");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Agenda 1ª Avaliação</h2>
        <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value as typeof originFilter)} className="input text-xs">
          <option value="all">Todas as origens</option>
          <option value="whatsapp_anamnese">{ORIGIN_LABEL.whatsapp_anamnese}</option>
          <option value="convenio_pdf">{ORIGIN_LABEL.convenio_pdf}</option>
          <option value="presencial">{ORIGIN_LABEL.presencial}</option>
        </select>
      </div>

      <Section
        title={`Aguardando agendamento (${aguardando.length})`}
        emptyLabel="Nenhum paciente aguardando agendamento de 1ª avaliação."
        items={aguardando}
        onJumpToTab={setTab}
      />

      <Section
        title={`Agendadas (${agendado.length})`}
        emptyLabel="Nenhuma 1ª avaliação agendada."
        items={agendado}
        onJumpToTab={setTab}
      />
    </div>
  );
}

function Section({
  title,
  emptyLabel,
  items,
  onJumpToTab,
}: {
  title: string;
  emptyLabel: string;
  items: EvaluationAgendaItem[];
  onJumpToTab: (tab: "triagens" | "acolhimentos") => void;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">{emptyLabel}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-paper-line-strong bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="p-3">Paciente</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Status</th>
                <th className="p-3">Horário</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-line">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="p-3 font-semibold text-ink">{item.patientName}</td>
                  <td className="p-3">
                    <span className={`tag-status ${ORIGIN_TAG[item.origin]}`}>{ORIGIN_LABEL[item.origin]}</span>
                  </td>
                  <td className="p-3 text-ink-soft">
                    {item.statusLabel}
                    <span className="block text-xs text-ink-faint">{item.detail}</span>
                  </td>
                  <td className="p-3 text-ink-soft">{item.scheduledAt ? fmtDateTime(item.scheduledAt) : "—"}</td>
                  <td className="p-3 text-right">
                    {item.jumpToTab ? (
                      <button
                        type="button"
                        onClick={() => onJumpToTab(item.jumpToTab as "triagens" | "acolhimentos")}
                        className="text-xs font-semibold text-chart hover:underline"
                      >
                        Ver na fila
                      </button>
                    ) : item.patientId ? (
                      <Link href={`/recepcao/pacientes/${item.patientId}`} className="text-xs font-semibold text-chart hover:underline">
                        Ver ficha
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
