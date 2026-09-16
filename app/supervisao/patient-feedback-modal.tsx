"use client";

import { useEffect, useState, useTransition } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  getActivePatientsForFeedbackAction,
  getEvaluationRoomsForFeedbackAction,
  getPatientEvaluationDetailsAction,
  bookPatientFeedbackAction,
} from "./patient-feedback-actions";

/**
 * "Devolutiva do paciente" — reunião com os pais marcada sob demanda da
 * Supervisão (não tem gatilho automático como a 1ª avaliação), sempre na sala
 * de avaliação. Reaproveita o padrão botão-gatilho + overlay próprio de
 * family-meeting-modal.tsx, mas aqui o paciente é escolhido no próprio
 * formulário (não vem de um chamado da Caixa de entrada).
 */
export function PatientFeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [patients, setPatients] = useState<{ id: string; name: string }[] | null>(null);
  const [rooms, setRooms] = useState<{ id: string; name: string }[] | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientId, setPatientId] = useState("");
  const [evalInfo, setEvalInfo] = useState<{
    roomId: string;
    roomName: string;
    date: string;
    time: string;
  } | null>(null);
  const [loadingEval, setLoadingEval] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen || patients !== null) return;
    getActivePatientsForFeedbackAction().then((res) => {
      if (res.success) setPatients(res.patients);
      else {
        setPatients([]);
        setFeedback({ type: "error", text: res.error });
      }
    });
    getEvaluationRoomsForFeedbackAction().then((res) => {
      if (res.success) {
        setRooms(res.rooms);
        setRoomId(res.rooms[0]?.id ?? "");
      } else {
        setRooms([]);
        setFeedback({ type: "error", text: res.error });
      }
    });
  }, [isOpen, patients]);

  const filteredPatients = (patients ?? []).filter((p) => p.name.toLowerCase().includes(patientQuery.trim().toLowerCase()));

  function handleSelectPatient(id: string, name: string) {
    setPatientId(id);
    setPatientQuery(name);
    setEvalInfo(null);
    setLoadingEval(true);

    getPatientEvaluationDetailsAction(id).then((res) => {
      setLoadingEval(false);
      if (res.success && res.evaluationInfo) {
        setEvalInfo(res.evaluationInfo);
        const evalRoomId = res.evaluationInfo.roomId;
        const evalRoomName = res.evaluationInfo.roomName;

        setRooms((prevRooms) => {
          const current = prevRooms ?? [];
          if (!current.some((r) => r.id === evalRoomId)) {
            return [{ id: evalRoomId, name: evalRoomName }, ...current];
          }
          return current;
        });

        setRoomId(evalRoomId);
      }
    });
  }

  function close() {
    setIsOpen(false);
    setFeedback(null);
    setDone(false);
    setPatientId("");
    setPatientQuery("");
    setEvalInfo(null);
    setDate("");
    setTime("");
  }

  function handleBook() {
    setFeedback(null);
    startTransition(async () => {
      const res = await bookPatientFeedbackAction({ patientId, roomId, date, time });
      if (res.success) {
        setDone(true);
        setFeedback({ type: "success", text: "Devolutiva marcada na agenda — a família já foi avisada pelo WhatsApp." });
      } else {
        setFeedback({ type: "error", text: res.error });
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="btn btn-secondary text-xs">
        <ClipboardCheck size={14} style={{ marginRight: 4 }} />
        Devolutiva do paciente
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-paper p-6 shadow-2xl space-y-4 border border-paper-line">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Marcar devolutiva do paciente</h3>
                <p className="text-xs text-ink-soft">Conversa da Supervisão com os pais sobre o acompanhamento — só a Supervisão marca.</p>
              </div>
              <button onClick={close} className="text-ink-soft hover:text-ink text-sm font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="field">
                <label>Paciente</label>
                <input
                  className="input"
                  value={patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setPatientId("");
                    setEvalInfo(null);
                  }}
                  placeholder="Buscar paciente pelo nome…"
                />
                {patients === null && <p className="mt-1 text-[11px] text-ink-faint">Carregando pacientes…</p>}
                {patients !== null && patientQuery.trim() && !patientId && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-paper-line-strong">
                    {filteredPatients.length === 0 && <p className="p-2 text-[11px] text-ink-faint">Nenhum paciente encontrado.</p>}
                    {filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="block w-full px-2 py-1.5 text-left text-xs hover:bg-paper"
                        onClick={() => handleSelectPatient(p.id, p.name)}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
                {loadingEval && <p className="mt-1 text-[11px] text-ink-faint">Buscando sala da 1ª avaliação…</p>}
                {evalInfo && (
                  <div className="mt-2 rounded-md bg-paper-subtle p-2.5 text-xs border border-paper-line text-ink-soft space-y-0.5">
                    <p className="font-semibold text-ink">
                      📍 1ª avaliação deste paciente: {evalInfo.roomName}
                    </p>
                    {evalInfo.date && evalInfo.time && (
                      <p className="text-[11px] text-ink-faint">
                        Agendada em {evalInfo.date.split("-").reverse().join("/")} às {evalInfo.time}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="field">
                <label>Sala de avaliação</label>
                <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  {rooms === null && <option value="">Carregando…</option>}
                  {rooms?.length === 0 && <option value="">Nenhuma sala de avaliação cadastrada</option>}
                  {rooms?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label>Data</label>
                  <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="field">
                  <label>Hora</label>
                  <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                disabled={isPending || !patientId || !roomId || !date || !time}
                onClick={handleBook}
              >
                {isPending ? "Confirmando…" : "Confirmar devolutiva"}
              </button>
            </div>

            {feedback && (
              <p className={`text-xs ${feedback.type === "success" ? "text-status-positive-text" : "text-status-negative-text"}`}>{feedback.text}</p>
            )}

            {done && (
              <div className="flex justify-end border-t border-paper-line pt-3">
                <button type="button" className="btn btn-secondary text-xs" onClick={close}>
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
