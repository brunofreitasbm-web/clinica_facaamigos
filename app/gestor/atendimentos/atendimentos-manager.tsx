"use client";

import { useMemo, useState } from "react";
import { AppointmentTypeDialog } from "./appointment-type-dialog";
import { DeleteAppointmentTypeButton } from "./delete-appointment-type-button";
import { MODALITY_LABEL, RECURRENCE_LABEL, type AppointmentType } from "./types";

export function AtendimentosManager({ appointmentTypes }: { appointmentTypes: AppointmentType[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return appointmentTypes;
    return appointmentTypes.filter((t) => t.name.toLowerCase().includes(term) || MODALITY_LABEL[t.modality]?.toLowerCase().includes(term));
  }, [appointmentTypes, search]);

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <input
          type="search"
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Buscar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <AppointmentTypeDialog />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Modalidade</th>
            <th>Duração</th>
            <th>Exibição</th>
            <th>Recorrência</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => (
            <tr key={t.id}>
              <td className="font-semibold">
                {t.name}
                {!t.active && <span className="tag-status st-cancelada ml-2">Inativo</span>}
              </td>
              <td>{MODALITY_LABEL[t.modality] ?? t.modality}</td>
              <td>{t.durationMinutes}m</td>
              <td>A cada {t.displayIntervalMinutes} minutos</td>
              <td>{RECURRENCE_LABEL[t.recurrence] ?? t.recurrence}</td>
              <td className="text-right">
                <div className="flex justify-end gap-1">
                  <AppointmentTypeDialog appointmentType={t} />
                  <DeleteAppointmentTypeButton id={t.id} name={t.name} />
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="text-ink-faint">
                {appointmentTypes.length === 0 ? "Nenhum tipo de atendimento cadastrado ainda." : "Nenhum resultado para essa busca."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-xs text-ink-faint">
        {filtered.length} de {appointmentTypes.length} tipos de atendimento
      </p>
    </div>
  );
}
