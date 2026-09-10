"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarHeart } from "lucide-react";
import {
  getSupervisorsAction,
  getGuardianPhoneAction,
  sendManualWhatsAppAction,
  sendTemplateWhatsAppAction,
  bookFamilyMeetingAction,
} from "./family-meeting-actions";

type Option = "whatsapp_manual" | "whatsapp_template" | "book";

export type FamilyMeetingCandidate = {
  id: string;
  patientId: string;
  guardianId: string | null;
  patientName: string;
};

/**
 * "Marcar reunião" — chamado de responsável de paciente já em acompanhamento
 * (não é a 1ª avaliação de lead novo, embora entre na mesma agenda). Reaproveita
 * o padrão de app/recepcao/agenda/reagendamento-dialog.tsx: botão-gatilho +
 * overlay próprio, sem lib de modal compartilhada.
 */
export function FamilyMeetingButton({ message, rooms }: { message: FamilyMeetingCandidate; rooms: { id: string; name: string }[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [option, setOption] = useState<Option>("whatsapp_manual");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [draft, setDraft] = useState(
    `Olá! Gostaríamos de agendar uma reunião sobre o acompanhamento de ${message.patientName}. Qual o melhor horário para você?`,
  );
  const [supervisors, setSupervisors] = useState<{ id: string; name: string }[] | null>(null);
  const [supervisorId, setSupervisorId] = useState("");
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => setPhoneError(null));
    getGuardianPhoneAction(message.patientId).then((res) => {
      if (res.success) setPhone(res.phone);
      else setPhoneError(res.error);
    });
  }, [isOpen, message.patientId]);

  useEffect(() => {
    if (isOpen && option === "book" && supervisors === null) {
      getSupervisorsAction().then((res) => {
        if (res.success) {
          setSupervisors(res.supervisors);
          setSupervisorId(res.supervisors[0]?.id ?? "");
        } else {
          setSupervisors([]);
          setFeedback({ type: "error", text: res.error });
        }
      });
    }
  }, [isOpen, option, supervisors]);

  function close() {
    setIsOpen(false);
    setFeedback(null);
    setDone(false);
  }

  function handleManualSend() {
    setFeedback(null);
    startTransition(async () => {
      const res = await sendManualWhatsAppAction({
        messageId: message.id,
        patientId: message.patientId,
        guardianId: message.guardianId,
        phone,
        body: draft,
      });
      if (res.success) {
        setDone(true);
        setFeedback({ type: "success", text: "Mensagem enviada e chamado marcado como tratado." });
      } else {
        setFeedback({ type: "error", text: res.error });
      }
    });
  }

  function handleTemplateSend() {
    setFeedback(null);
    startTransition(async () => {
      const res = await sendTemplateWhatsAppAction({
        messageId: message.id,
        patientId: message.patientId,
        guardianId: message.guardianId,
        phone,
        patientName: message.patientName,
      });
      if (res.success) {
        setDone(true);
        setFeedback({ type: "success", text: "Template enviado e chamado marcado como tratado." });
      } else {
        setFeedback({ type: "error", text: res.error });
      }
    });
  }

  function handleBook() {
    setFeedback(null);
    startTransition(async () => {
      const res = await bookFamilyMeetingAction({
        messageId: message.id,
        patientId: message.patientId,
        supervisorId,
        roomId,
        date,
        time,
      });
      if (res.success) {
        setDone(true);
        setFeedback({ type: "success", text: "Reunião marcada na agenda de 1ª avaliação." });
      } else {
        setFeedback({ type: "error", text: res.error });
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="btn btn-secondary text-xs" style={{ padding: "4px 8px" }}>
        <CalendarHeart size={14} style={{ marginRight: 4 }} />
        Marcar reunião
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-paper p-6 shadow-2xl space-y-4 border border-paper-line">
            <div className="flex items-center justify-between border-b border-paper-line pb-3">
              <div>
                <h3 className="text-base font-bold text-ink">Marcar reunião com responsável</h3>
                <p className="text-xs text-ink-soft">{message.patientName}</p>
              </div>
              <button onClick={close} className="text-ink-soft hover:text-ink text-sm font-bold">
                ✕
              </button>
            </div>

            {phoneError && <p className="text-xs" style={{ color: "var(--status-falta)" }}>{phoneError}</p>}

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOption("whatsapp_manual")}
                className={`rounded-md border p-2 text-xs font-semibold ${option === "whatsapp_manual" ? "border-accent bg-accent/10" : "border-paper-line-strong"}`}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setOption("whatsapp_template")}
                className={`rounded-md border p-2 text-xs font-semibold ${option === "whatsapp_template" ? "border-accent bg-accent/10" : "border-paper-line-strong"}`}
              >
                Template Twilio
              </button>
              <button
                type="button"
                onClick={() => setOption("book")}
                className={`rounded-md border p-2 text-xs font-semibold ${option === "book" ? "border-accent bg-accent/10" : "border-paper-line-strong"}`}
              >
                Escolher supervisor
              </button>
            </div>

            {option === "whatsapp_manual" && (
              <div className="space-y-3">
                <div className="field">
                  <label>Telefone do responsável</label>
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55..." />
                </div>
                <div className="field">
                  <label>Mensagem</label>
                  <textarea className="input" value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} />
                </div>
                <button type="button" className="btn btn-primary" disabled={isPending || !phone.trim() || !draft.trim()} onClick={handleManualSend}>
                  {isPending ? "Enviando…" : "Enviar via WhatsApp"}
                </button>
              </div>
            )}

            {option === "whatsapp_template" && (
              <div className="space-y-3">
                <p className="text-xs text-ink-soft">
                  Envia um template pré-aprovado pela Meta via Twilio — use quando a janela de 24h de atendimento já fechou.
                </p>
                <div className="field">
                  <label>Telefone do responsável</label>
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55..." />
                </div>
                <button type="button" className="btn btn-primary" disabled={isPending || !phone.trim()} onClick={handleTemplateSend}>
                  {isPending ? "Enviando…" : "Enviar template"}
                </button>
              </div>
            )}

            {option === "book" && (
              <div className="space-y-3">
                <div className="field">
                  <label>Supervisor</label>
                  <select className="input" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
                    {supervisors === null && <option value="">Carregando…</option>}
                    {supervisors?.length === 0 && <option value="">Nenhum supervisor cadastrado</option>}
                    {supervisors?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Sala</label>
                  <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                    {rooms.map((r) => (
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
                  disabled={isPending || !supervisorId || !roomId || !date || !time}
                  onClick={handleBook}
                >
                  {isPending ? "Confirmando…" : "Confirmar reunião"}
                </button>
              </div>
            )}

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
