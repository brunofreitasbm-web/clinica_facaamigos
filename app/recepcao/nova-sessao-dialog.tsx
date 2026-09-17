"use client";

// Diálogo "Nova sessão" da home da recepção (Recepcao.dc.html) — mesma
// Server Action `createAppointment` da agenda (app/recepcao/agenda/actions.ts),
// só que apresentada como modal e com o preview de guia vigente por paciente
// (PRD §9.3: "bloqueio de agendamento sem guia vigente" vira aviso + checkbox
// "provisória" em vez de bloqueio duro — quem decide é a recepção).

import { useEffect, useMemo, useState, useTransition } from "react";
import { createAppointment } from "./agenda/actions";
import { getGroupSlotOccupancy, type GroupSlotOccupancy } from "./agenda/group-actions";
import {
  formatAbaClassLabel,
  toHourMinute,
  WEEKDAY_LABELS,
  type AbaBalance,
  type AbaClassOption,
} from "@/lib/aba-training";
import { filterEvaluationRooms } from "@/lib/evaluation-agenda";
import { canJoinGroupSlot } from "@/lib/group-slot-rules";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc } from "@/lib/timezone";

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
  /** 'treino' = bloco de Treino ABA, agendado em turma. Ver lib/aba-training.ts. */
  abaRole: string | null;
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
  abaClasses,
  abaBalanceByPatient,
}: {
  patients: { id: string; full_name: string; birth_date?: string | null }[];
  therapists: { id: string; full_name: string }[];
  rooms: { id: string; name: string; is_evaluation_room?: boolean }[];
  appointmentTypes: AppointmentTypeOption[];
  guidesByPatient: Record<string, GuideSummary>;
  defaultDate: string;
  abaClasses: AbaClassOption[];
  abaBalanceByPatient: Record<string, AbaBalance>;
}) {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [showPatientOptions, setShowPatientOptions] = useState(false);
  const [isProvisional, setIsProvisional] = useState(false);
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [abaClassId, setAbaClassId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Estado controlado só pra alimentar a pré-checagem de ocupação de grupo
  // (RPC group_slot_occupancy) — o form em si continua sendo submetido via
  // FormData não-controlado pros demais campos.
  const [modality, setModality] = useState("individual");
  const [therapistId, setTherapistId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [groupOccupancy, setGroupOccupancy] = useState<GroupSlotOccupancy | null>(null);
  const [groupOccupancyLoading, setGroupOccupancyLoading] = useState(false);

  const guide = useMemo(() => guidesByPatient[patientId] ?? null, [guidesByPatient, patientId]);

  // Treino ABA troca o formulario inteiro: sala, horario e modalidade deixam
  // de ser escolha da recepcao e passam a vir da turma (createAppointment
  // ignora esses campos nesse caso), e o preview de guia vira o saldo somado
  // das quatro guias ABA.
  const isAbaTraining = useMemo(
    () => appointmentTypes.find((t) => t.id === appointmentTypeId)?.abaRole === "treino",
    [appointmentTypes, appointmentTypeId],
  );

  const isEvaluationType = useMemo(() => {
    if (!appointmentTypeId) return false;
    const selectedType = appointmentTypes.find((t) => t.id === appointmentTypeId);
    if (!selectedType) return false;
    const nameLower = selectedType.name.toLowerCase();
    return nameLower.includes("avalia") || nameLower.includes("anamnese") || nameLower.includes("acolhimento");
  }, [appointmentTypes, appointmentTypeId]);

  const availableRooms = useMemo(() => {
    if (!isEvaluationType) return rooms;
    return filterEvaluationRooms(rooms);
  }, [rooms, isEvaluationType]);
  const selectedAbaClass = useMemo(
    () => abaClasses.find((c) => c.id === abaClassId) ?? null,
    [abaClasses, abaClassId],
  );
  const abaBalance = abaBalanceByPatient[patientId] ?? null;

  const selectedAppointmentType = useMemo(
    () => appointmentTypes.find((t) => t.id === appointmentTypeId) ?? null,
    [appointmentTypes, appointmentTypeId],
  );

  const isGroup = !isAbaTraining && modality === "grupo";

  // Consulta a ocupação do grupo (RPC group_slot_occupancy) sempre que
  // terapeuta + data + horário + duração estiverem completos — só uma
  // pré-checagem otimista pra desabilitar o botão antes de bater no guard do
  // banco (appointments_group_capacity_guard), que continua sendo a
  // autoridade final contra condição de corrida.
  useEffect(() => {
    if (!isGroup || !therapistId || !date || !time || !selectedAppointmentType) {
      setGroupOccupancy(null);
      return;
    }
    let cancelled = false;
    setGroupOccupancyLoading(true);
    const timer = window.setTimeout(() => {
      const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
      const endsAt = new Date(startsAt.getTime() + selectedAppointmentType.durationMinutes * 60 * 1000);
      getGroupSlotOccupancy(therapistId, startsAt.toISOString(), endsAt.toISOString()).then((result) => {
        if (cancelled) return;
        setGroupOccupancyLoading(false);
        setGroupOccupancy(result.success ? result.data : null);
      });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isGroup, therapistId, date, time, selectedAppointmentType]);

  const selectedPatientBirthDate = useMemo(() => {
    const raw = patients.find((p) => p.id === patientId)?.birth_date;
    return raw ? new Date(`${raw}T00:00:00Z`) : null;
  }, [patients, patientId]);

  // Pré-checagem client-side (lib/group-slot-rules.ts, espelho do trigger):
  // usa min/max_birth já devolvidos pela RPC como as duas datas extremas do
  // grupo atual — suficiente pra reproduzir a mesma regra de faixa etária.
  const groupSlotCheck = useMemo(() => {
    if (!isGroup || !groupOccupancy) return null;
    const existingBirthDates = [groupOccupancy.minBirth, groupOccupancy.maxBirth]
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(`${d}T00:00:00Z`));
    return canJoinGroupSlot({
      existingBirthDates,
      maxSize: groupOccupancy.maxSize,
      candidateBirthDate: selectedPatientBirthDate ?? new Date(),
    });
  }, [isGroup, groupOccupancy, selectedPatientBirthDate]);

  const groupBlockReason = useMemo(() => {
    if (!isGroup) return null;
    if (!groupSlotCheck || groupSlotCheck.ok) return null;
    if (groupSlotCheck.reason === "lotado") {
      return `Grupo lotado (${groupOccupancy?.occupied ?? 0}/${groupOccupancy?.maxSize ?? 3}) neste horário.`;
    }
    return "Diferença de idade em relação às demais crianças do horário é maior que 2 anos.";
  }, [isGroup, groupSlotCheck, groupOccupancy]);

  const groupSubmitDisabled = Boolean(isGroup && patientId && therapistId && date && time && groupBlockReason);

  const patientMatches = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [patients, patientQuery]);

  function selectPatient(p: { id: string; full_name: string }) {
    setPatientId(p.id);
    setPatientQuery(p.full_name);
    setShowPatientOptions(false);
  }

  // Deep link `/recepcao#nova-sessao` (atalho da aba Fluxos da supervisão) ou
  // `/recepcao#nova-sessao:<patientId>` (botão "Nova sessão" da ficha do
  // paciente, app/recepcao/pacientes/[id]/page.tsx, que antes só mandava pra
  // "/recepcao" sem nenhum contexto — o atendente tinha que reabrir o
  // diálogo e reselecionar o paciente do zero): abre o diálogo direto,
  // pré-seleciona o paciente se veio um id, e limpa o hash pra um F5 não
  // reabrir sozinho.
  function openFromHash() {
    const hash = window.location.hash;
    if (hash !== "#nova-sessao" && !hash.startsWith("#nova-sessao:")) return;
    const preselectId = hash.startsWith("#nova-sessao:") ? hash.slice("#nova-sessao:".length) : "";
    setOpen(true);
    if (preselectId) {
      setPatientId(preselectId);
      setPatientQuery(patients.find((p) => p.id === preselectId)?.full_name ?? "");
    }
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  useEffect(() => {
    const initial = window.setTimeout(openFromHash, 0);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("hashchange", openFromHash);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients]);

  // Atalho de teclado global: Ctrl + N ou Cmd + N para acionar diretamente o modal de nova sessão
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        // Ignora se estiver num input/textarea/select para evitar conflito na digitação
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function close() {
    setOpen(false);
    setPatientId("");
    setPatientQuery("");
    setShowPatientOptions(false);
    setIsProvisional(false);
    setAppointmentTypeId("");
    setAbaClassId("");
    setError(null);
    setModality("individual");
    setTherapistId("");
    setDate(defaultDate);
    setTime("");
    setGroupOccupancy(null);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Nova Sessão (Ctrl+N)"
        title="Agendar nova sessão (Ctrl+N)"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700 active:bg-teal-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-2 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden>
          <path d="M128 40v176M40 128h176" stroke="currentColor" strokeWidth="24" strokeLinecap="round" />
        </svg>
        <span>+ Nova sessão</span>
        <kbd className="hidden sm:inline-block rounded bg-teal-700/60 px-1.5 py-0.5 text-[10px] font-normal text-teal-100">
          Ctrl+N
        </kbd>
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
                <div className="field sm:col-span-2" style={{ position: "relative" }}>
                  <label>Paciente</label>
                  <input type="hidden" name="patient_id" value={patientId} required />
                  <input
                    type="text"
                    className="input"
                    placeholder="Digite o nome do paciente…"
                    value={patientQuery}
                    onChange={(e) => {
                      setPatientQuery(e.target.value);
                      setPatientId("");
                      setShowPatientOptions(true);
                    }}
                    onFocus={() => setShowPatientOptions(true)}
                    onBlur={() => window.setTimeout(() => setShowPatientOptions(false), 150)}
                    autoComplete="off"
                  />
                  {showPatientOptions && (
                    <ul
                      className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-paper-line-strong bg-paper shadow-lg"
                      style={{ listStyle: "none", padding: 0, margin: 0 }}
                    >
                      {patientMatches.length === 0 && (
                        <li className="px-3 py-2 text-xs text-ink-faint">Nenhum paciente encontrado.</li>
                      )}
                      {patientMatches.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-chart-soft"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectPatient(p)}
                          >
                            {p.full_name}
                            <span className="ml-1 text-xs text-ink-faint">
                              {guidesByPatient[p.id] ? `· guia ${guidesByPatient[p.id].insurerName} ativa` : "· sem guia ativa"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="field">
                  <label>Tipo de atendimento</label>
                  <select
                    name="appointment_type_id"
                    required
                    className="input"
                    value={appointmentTypeId}
                    onChange={(e) => {
                      setAppointmentTypeId(e.target.value);
                      setAbaClassId("");
                    }}
                  >
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
                  <select
                    name="therapist_id"
                    required
                    className="input"
                    value={therapistId}
                    onChange={(e) => setTherapistId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {therapists.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                {isAbaTraining ? (
                  <div className="field">
                    <label>Turma de Treino ABA</label>
                    <select
                      name="aba_class_id"
                      required
                      className="input"
                      value={abaClassId}
                      onChange={(e) => setAbaClassId(e.target.value)}
                    >
                      <option value="" disabled>
                        Selecione a turma…
                      </option>
                      {abaClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatAbaClassLabel(c)}
                        </option>
                      ))}
                    </select>
                    {abaClasses.length === 0 && (
                      <p className="text-xs text-ink-faint">
                        Nenhuma turma aberta — cadastre em Cadastros › Salas &amp; Recursos.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="field">
                    <label>Sala</label>
                    <select name="room_id" required className="input">
                      <option value="">Selecione…</option>
                      {availableRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label>Data</label>
                  <input
                    type="date"
                    name="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input"
                  />
                  {isAbaTraining && selectedAbaClass && (
                    <p className="text-xs text-ink-faint">
                      Essa turma só acontece na {WEEKDAY_LABELS[selectedAbaClass.dayOfWeek].toLowerCase()}.
                    </p>
                  )}
                </div>
                {isAbaTraining ? (
                  <div className="field">
                    <label>Horário</label>
                    <input
                      type="text"
                      className="input"
                      readOnly
                      value={
                        selectedAbaClass
                          ? `${toHourMinute(selectedAbaClass.startTime)} · bloco de 2h (3 × 40min)`
                          : "Definido pela turma"
                      }
                    />
                  </div>
                ) : (
                  <div className="field">
                    <label>Horário</label>
                    <input
                      type="time"
                      name="time"
                      required
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="input"
                    />
                  </div>
                )}
                {!isAbaTraining && (
                  <div className="field sm:col-span-2">
                    <label>Modalidade de Atendimento</label>
                    <select
                      name="modality"
                      className="input"
                      value={modality}
                      onChange={(e) => setModality(e.target.value)}
                    >
                      <option value="individual">Individual (Presencial)</option>
                      <option value="grupo">Grupo / Escola (Multi-paciente)</option>
                      <option value="remoto">Remoto / Telessessão (Vídeo)</option>
                    </select>
                  </div>
                )}
              </div>

              {patientId && isAbaTraining && (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 2,
                    background:
                      abaBalance && abaBalance.blocksAvailable > 0
                        ? "var(--status-confirmada-bg)"
                        : "var(--status-falta-bg)",
                    fontSize: 14,
                    color:
                      abaBalance && abaBalance.blocksAvailable > 0
                        ? "var(--status-realizada)"
                        : "var(--status-falta)",
                  }}
                >
                  <strong>
                    {abaBalance && abaBalance.blocksAvailable > 0
                      ? `${abaBalance.blocksAvailable} bloco(s) de Treino ABA no saldo`
                      : "Sem saldo para um bloco de Treino ABA"}
                  </strong>
                  <div style={{ fontSize: 13, marginTop: 2, opacity: 0.9 }}>
                    {abaBalance && abaBalance.sessionsRemaining > 0
                      ? `${abaBalance.sessionsRemaining} sessões somadas nas guias ABA vigentes · cada bloco de 2h consome 3.`
                      : "Nenhuma guia ABA vigente (Psicologia, Fonoaudiologia, Terapia Ocupacional ou Psicopedagogia ABA)."}
                  </div>
                </div>
              )}

              {patientId && !isAbaTraining && (
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

              {isGroup && therapistId && date && time && (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 2,
                    background: groupBlockReason ? "var(--status-falta-bg)" : "var(--status-confirmada-bg)",
                    fontSize: 14,
                    color: groupBlockReason ? "var(--status-falta)" : "var(--status-realizada)",
                  }}
                >
                  <strong>
                    {groupOccupancyLoading
                      ? "Consultando ocupação do grupo…"
                      : groupOccupancy
                        ? `Ocupação do grupo: ${groupOccupancy.occupied}/${groupOccupancy.maxSize}${
                            groupOccupancy.patientNames.length ? ` — ${groupOccupancy.patientNames.join(", ")}` : ""
                          }`
                        : "Nenhuma sessão de grupo nesse horário ainda."}
                  </strong>
                  {groupBlockReason && (
                    <div style={{ fontSize: 13, marginTop: 2, opacity: 0.9 }}>{groupBlockReason}</div>
                  )}
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isPending || groupSubmitDisabled}
                  title={groupSubmitDisabled ? groupBlockReason ?? undefined : undefined}
                >
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
