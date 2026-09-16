"use client";

import { useMemo, useState } from "react";
import { AppointmentTypeDialog } from "./appointment-type-dialog";
import { DeleteAppointmentTypeButton } from "./delete-appointment-type-button";
import { MODALITY_LABEL, RECURRENCE_LABEL, type AppointmentType, type InsurerOption } from "./types";
import { PageContainer } from "@/components/page-container";

export function AtendimentosManager({
  appointmentTypes,
  insurers = [],
}: {
  appointmentTypes: AppointmentType[];
  insurers?: InsurerOption[];
}) {
  const [search, setSearch] = useState("");
  const [selectedInsurerId, setSelectedInsurerId] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = appointmentTypes;

    if (selectedInsurerId !== "all") {
      if (selectedInsurerId === "geral") {
        result = result.filter((t) => !t.insurerId);
      } else {
        result = result.filter((t) => t.insurerId === selectedInsurerId);
      }
    }

    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          (t.procedureCode && t.procedureCode.toLowerCase().includes(term)) ||
          (t.insurerName && t.insurerName.toLowerCase().includes(term)) ||
          MODALITY_LABEL[t.modality]?.toLowerCase().includes(term),
      );
    }
    return result;
  }, [appointmentTypes, selectedInsurerId, search]);

  return (
    <PageContainer>
      {/* Insurer Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-paper-line pb-3 mb-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            selectedInsurerId === "all"
              ? "bg-accent text-white"
              : "bg-paper-line/50 text-ink-soft hover:bg-paper-line"
          }`}
          onClick={() => setSelectedInsurerId("all")}
        >
          Todos os Planos ({appointmentTypes.length})
        </button>
        {insurers.map((ins) => {
          const count = appointmentTypes.filter((t) => t.insurerId === ins.id).length;
          return (
            <button
              key={ins.id}
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                selectedInsurerId === ins.id
                  ? "bg-accent text-white"
                  : "bg-paper-line/50 text-ink-soft hover:bg-paper-line"
              }`}
              onClick={() => setSelectedInsurerId(ins.id)}
            >
              {ins.name} ({count})
            </button>
          );
        })}
        <button
          type="button"
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            selectedInsurerId === "geral"
              ? "bg-accent text-white"
              : "bg-paper-line/50 text-ink-soft hover:bg-paper-line"
          }`}
          onClick={() => setSelectedInsurerId("geral")}
        >
          Geral / Particular ({appointmentTypes.filter((t) => !t.insurerId).length})
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 my-3">
        <input
          type="search"
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Buscar tipo ou código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <AppointmentTypeDialog insurers={insurers} />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Procedimento / Atendimento</th>
            <th>Plano de Saúde</th>
            <th>Código</th>
            <th>Duração</th>
            <th>Recorrência / Exibição</th>
            <th>Regra Estagiários</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => (
            <tr key={t.id}>
              <td className="font-semibold">
                {t.name}
                {!t.active && <span className="tag-status st-cancelada ml-2">Inativo</span>}
              </td>
              <td>
                {t.insurerName ? (
                  <span className="rounded bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                    {t.insurerName}
                  </span>
                ) : (
                  <span className="text-ink-faint text-xs">Geral / Particular</span>
                )}
              </td>
              <td>
                {t.procedureCode ? (
                  <span className="font-mono text-xs font-semibold text-ink-soft">{t.procedureCode}</span>
                ) : (
                  <span className="text-ink-faint text-xs">—</span>
                )}
              </td>
              <td className="font-medium">{t.durationMinutes} min</td>
              <td>{RECURRENCE_LABEL[t.recurrence] ?? t.recurrence}</td>
              <td>
                {t.requiresInternRatio ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    1 Estagiário / Criança
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Isento (1:1 Terapeuta)
                  </span>
                )}
              </td>
              <td className="text-right">
                <div className="flex justify-end">
                  <AppointmentTypeDialog appointmentType={t} insurers={insurers} />
                  <DeleteAppointmentTypeButton id={t.id} name={t.name} />
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="text-ink-faint py-6 text-center">
                {appointmentTypes.length === 0
                  ? "Nenhum tipo de atendimento cadastrado ainda."
                  : "Nenhum procedimento encontrado para esse filtro."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-xs text-ink-faint mt-2">
        Exibindo {filtered.length} de {appointmentTypes.length} tipos de atendimento
      </p>
    </PageContainer>
  );
}
