"use client";

// Diálogo "Nova sessão" da home da recepção (Recepcao.dc.html) — mesma
// Server Action `createAppointment` da agenda (app/recepcao/agenda/actions.ts),
// só que apresentada como modal e com o preview de guia vigente por paciente
// (PRD §9.3: "bloqueio de agendamento sem guia vigente" vira aviso + checkbox
// "provisória" em vez de bloqueio duro — quem decide é a recepção).

import { useMemo, useState, useTransition } from "react";
import { createAppointment } from "./agenda/actions";

export type GuideSummary = {
  insurerName: string;
  guideNumber: string | null;
  sessionsUsed: number;
  sessionsAuthorized: number;
  validTo: string;
};

export type AppointmentTypeOption = {
  id: string;
  name: string;
  durationMinutes: number;
};

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

export function NovaSessaoDialog({
  patients,
  therapists,
  rooms,
  appointmentTypes,
  guidesByPatient,
  defaultDate,
}: {
  patients: { id: string; full_name: string }[];
  therapists: { id: string; full_name: string }[];
  rooms: { id: string; name: string }[];
  appointmentTypes: AppointmentTypeOption[];
  guidesByPatient: Record<string, GuideSummary>;
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [isProvisional, setIsProvisional] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const guide = useMemo(() => guidesByPatient[patientId] ?? null, [guidesByPatient, patientId]);

  function close() {
    setOpen(false);
    setPatientId("");
    setIsProvisional(false);
    setError(null);
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden>
          <path d="M128 40v176M40 128h176" stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
        </svg>
        Nova sessão
      </button>

      {open && (
        <div className="dialog-backdrop" onClick={close}>
          <div className="dialog" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="card-kicker">Nova sessão</div>
              <div className="dialog-title">Agendar sessão</div>
            </div>

            <form
              className="flex flex-col gap-3.5"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  const result = await createAppointment(formData);
                  if (!result.success) {
                    setError(result.error);
                    return;
                  }
                  close();
                });
              }}
            >
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="field sm:col-span-2">
                  <label>Paciente</label>
                  <select
                    name="patient_id"
                    required
                    className="input"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                        {guidesByPatient[p.id] ? ` · guia ${guidesByPatient[p.id].insurerName} ativa` : " · sem guia ativa"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Tipo de atendimento</label>
                  <select name="appointment_type_id" required className="input" defaultValue="">
                    <option value="" disabled>
                      Selecione…
                    </option>
                    {appointmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.durationMinutes}min
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Terapeuta</label>
                  <select name="therapist_id" required className="input">
                    <option value="">Selecione…</option>
                    {therapists.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Sala</label>
                  <select name="room_id" required className="input">
                    <option value="">Selecione…</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Data</label>
                  <input type="date" name="date" required defaultValue={defaultDate} className="input" />
                </div>
                <div className="field">
                  <label>Horário</label>
                  <input type="time" name="time" required className="input" />
                </div>
                <div className="field sm:col-span-2">
                  <label>Modalidade de Atendimento</label>
                  <select name="modality" className="input" defaultValue="individual">
                    <option value="individual">Individual (Presencial)</option>
                    <option value="grupo">Grupo / Escola (Multi-paciente)</option>
                    <option value="remoto">Remoto / Telessessão (Vídeo)</option>
                  </select>
                </div>
              </div>

              {patientId && (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 2,
                    background: guide ? "var(--status-confirmada-bg)" : "var(--status-falta-bg)",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    fontSize: 14,
                    color: guide ? "var(--status-realizada)" : "var(--status-falta)",
                  }}
                >
                  <div>
                    <strong>{guide ? "Guia vigente" : "Sem guia vigente"}</strong>
                    <div style={{ fontSize: 13, marginTop: 2, opacity: 0.9 }}>
                      {guide
                        ? `${guide.insurerName} · ${guide.sessionsUsed} de ${guide.sessionsAuthorized} sessões usadas · válida até ${fmtDate(guide.validTo)}`
                        : "Marque como provisória para agendar mesmo assim, ou registre a guia antes de realizar a sessão."}
                    </div>
                  </div>
                </div>
              )}

              <label className="radio" style={{ fontSize: 13 }}>
                <input
                  type="checkbox"
                  name="is_provisional"
                  checked={isProvisional}
                  onChange={(e) => setIsProvisional(e.target.checked)}
                />
                <span className="dot" style={{ borderRadius: 2 }} />
                Marcar como provisória (não conta na guia; precisa de guia antes de realizar)
              </label>

              {error && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{error}</p>}

              <div className="dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={close}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? "Agendando…" : "Agendar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
