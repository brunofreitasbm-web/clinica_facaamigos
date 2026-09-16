"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPresencialAcolhimentoAction,
  type CreatePresencialAcolhimentoResult,
} from "./acolhimento-presencial-actions";

type OptionItem = { id: string; name?: string; full_name?: string; is_evaluation_room?: boolean };

export function AcolhimentoPresencialDialog({
  insurers = [],
  therapists = [],
  rooms = [],
}: {
  insurers?: OptionItem[];
  therapists?: OptionItem[];
  rooms?: OptionItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatePresencialAcolhimentoResult | null>(null);

  const evaluationRooms = useMemo(() => {
    const filtered = rooms.filter((r) => r.is_evaluation_room || (r.name || r.full_name || "").toLowerCase().includes("avalia"));
    return filtered.length > 0 ? filtered : rooms.filter((r) => Boolean(r.is_evaluation_room));
  }, [rooms]);

  // Form states - Paciente
  const [patientFullName, setPatientFullName] = useState("");
  const [patientBirthDate, setPatientBirthDate] = useState("");
  const [patientCpf, setPatientCpf] = useState("");
  const [patientSexo, setPatientSexo] = useState("M");
  const [patientCid, setPatientCid] = useState("F84.0");
  const [patientSupportLevel, setPatientSupportLevel] = useState("");
  const [patientMedication, setPatientMedication] = useState("");
  const [patientAllergies, setPatientAllergies] = useState("");
  const [patientComorbidities, setPatientComorbidities] = useState("");

  // Form states - Responsável
  const [guardianFullName, setGuardianFullName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianCpf, setGuardianCpf] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("Mãe");

  // Form states - Convênio & Guia
  const [insurerId, setInsurerId] = useState(insurers[0]?.id || "");
  const [planName, setPlanName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardValidUntil, setCardValidUntil] = useState("");
  const [guideNumber, setGuideNumber] = useState("");
  const [procedureCode, setProcedureCode] = useState("40101010");
  const [sessionsAuthorized, setSessionsAuthorized] = useState<number>(10);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState("");
  const [authorizationPassword, setAuthorizationPassword] = useState("");

  // Checklist de documentos físicos
  const [printedDocsChecked, setPrintedDocsChecked] = useState(true);
  const [medicalLaudoChecked, setMedicalLaudoChecked] = useState(true);
  const [authorizedGuideChecked, setAuthorizedGuideChecked] = useState(true);

  // Agendamento Imediato
  const [scheduleNow, setScheduleNow] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState(therapists[0]?.id || "");
  const [selectedRoomId, setSelectedRoomId] = useState(evaluationRooms[0]?.id || rooms[0]?.id || "");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedTime, setSelectedTime] = useState("09:00");

  const resetForm = () => {
    setPatientFullName("");
    setPatientBirthDate("");
    setPatientCpf("");
    setPatientSexo("M");
    setPatientCid("F84.0");
    setGuardianFullName("");
    setGuardianPhone("");
    setGuardianCpf("");
    setGuardianRelationship("Mãe");
    setInsurerId(insurers[0]?.id || "");
    setPlanName("");
    setCardNumber("");
    setCardValidUntil("");
    setGuideNumber("");
    setProcedureCode("40101010");
    setSessionsAuthorized(10);
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidTo("");
    setAuthorizationPassword("");
    setPrintedDocsChecked(true);
    setMedicalLaudoChecked(true);
    setAuthorizedGuideChecked(true);
    setScheduleNow(false);
    setError(null);
    setResult(null);
  };

  const handleOpen = () => {
    resetForm();
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await createPresencialAcolhimentoAction({
      patientFullName,
      patientBirthDate,
      patientCpf: patientCpf || undefined,
      patientSexo,
      patientCid: patientCid || undefined,
      patientSupportLevel: patientSupportLevel || undefined,
      patientMedication: patientMedication || undefined,
      patientAllergies: patientAllergies || undefined,
      patientComorbidities: patientComorbidities || undefined,
      guardianFullName,
      guardianPhone,
      guardianCpf: guardianCpf || undefined,
      guardianRelationship,
      insurerId,
      planName: planName || undefined,
      cardNumber: cardNumber || undefined,
      cardValidUntil: cardValidUntil || undefined,
      guideNumber,
      procedureCode: procedureCode || undefined,
      sessionsAuthorized: Number(sessionsAuthorized) || 10,
      validFrom: validFrom || undefined,
      validTo: validTo || undefined,
      authorizationPassword: authorizationPassword || undefined,
      documentsChecked: {
        printedDocs: printedDocsChecked,
        medicalLaudo: medicalLaudoChecked,
        authorizedGuide: authorizedGuideChecked,
      },
      scheduleNow,
      appointmentDetails: scheduleNow
        ? {
            therapistId: selectedTherapistId,
            roomId: selectedRoomId,
            date: selectedDate,
            time: selectedTime,
          }
        : undefined,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Erro ao registrar acolhimento presencial.");
      return;
    }

    setResult(res);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Novo Acolhimento Presencial"
        onClick={handleOpen}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-2 cursor-pointer"
      >
        <span>📍</span> Novo Acolhimento Presencial
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl transition-all my-auto"
            style={{ background: "var(--color-surface, #ffffff)", color: "var(--color-ink, #0f172a)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4 bg-amber-500 text-white rounded-t-xl">
              <div>
                <h3 style={{ fontFamily: "var(--font-heading)" }} className="text-base font-bold flex items-center gap-2">
                  <span>📍</span> Cadastrar Acolhimento Presencial (Na Clínica)
                </h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  Paciente fisicamente na recepção com laudo, guia autorizada e documentações impressas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-white/80 hover:bg-black/20 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {result && result.success ? (
                <div className="space-y-5 text-center py-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-800">Acolhimento Presencial Registrado!</h4>
                    <p className="text-sm text-slate-600 mt-1">{result.message}</p>
                  </div>

                  {result.scheduled && result.appointmentInfo && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-left space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        🗓️ 1ª Avaliação Agendada
                      </div>
                      <div className="text-sm font-semibold text-slate-800">
                        {patientFullName}
                      </div>
                      <div className="text-xs text-slate-600 grid grid-cols-2 gap-2 pt-1">
                        <div><span className="font-medium">Data:</span> {result.appointmentInfo.date} às {result.appointmentInfo.time}</div>
                        <div><span className="font-medium">Sala:</span> {result.appointmentInfo.roomName || "Definida"}</div>
                        <div><span className="font-medium">Avaliador:</span> {result.appointmentInfo.therapistName || "Definido"}</div>
                        <div><span className="font-medium">Status:</span> Agendado (Na Clínica)</div>
                      </div>
                    </div>
                  )}

                  {!result.scheduled && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left text-xs text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>🚨</span> Enviado ao Supervisor com PRIORIDADE ALTA
                      </div>
                      <p>
                        Este acolhimento foi destacado no topo da tela da Supervisão como paciente presente na clínica para agendamento prioritário.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-center gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (result.patientId) {
                          router.push(`/recepcao/pacientes/${result.patientId}`);
                        }
                        setOpen(false);
                      }}
                      className="rounded-md bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                    >
                      Ver Ficha do Paciente
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Concluir Atendimento
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="rounded-md bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                      ⚠️ {error}
                    </div>
                  )}

                  {/* Paciente */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 border-b pb-1">
                      1. Paciente (Criança / Atendido)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Nome Completo do Paciente *
                        </label>
                        <input
                          type="text"
                          required
                          value={patientFullName}
                          onChange={(e) => setPatientFullName(e.target.value)}
                          placeholder="Ex: Gabriel Souza Santos"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Data de Nascimento *
                        </label>
                        <input
                          type="date"
                          required
                          value={patientBirthDate}
                          onChange={(e) => setPatientBirthDate(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          CPF do Paciente
                        </label>
                        <input
                          type="text"
                          value={patientCpf}
                          onChange={(e) => setPatientCpf(e.target.value)}
                          placeholder="000.000.000-00"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Sexo
                        </label>
                        <select
                          value={patientSexo}
                          onChange={(e) => setPatientSexo(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none bg-white"
                        >
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          CID-10 (Laudo Médico)
                        </label>
                        <input
                          type="text"
                          value={patientCid}
                          onChange={(e) => setPatientCid(e.target.value)}
                          placeholder="Ex: F84.0"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Nível de Suporte
                        </label>
                        <input
                          type="text"
                          value={patientSupportLevel}
                          onChange={(e) => setPatientSupportLevel(e.target.value)}
                          placeholder="1, 2 ou 3"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Comorbidades
                        </label>
                        <input
                          type="text"
                          value={patientComorbidities}
                          onChange={(e) => setPatientComorbidities(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Medicação e Uso
                        </label>
                        <input
                          type="text"
                          value={patientMedication}
                          onChange={(e) => setPatientMedication(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Alergias
                        </label>
                        <input
                          type="text"
                          value={patientAllergies}
                          onChange={(e) => setPatientAllergies(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Responsável */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 border-b pb-1">
                      2. Responsável Legal
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Nome do Responsável *
                        </label>
                        <input
                          type="text"
                          required
                          value={guardianFullName}
                          onChange={(e) => setGuardianFullName(e.target.value)}
                          placeholder="Ex: Maria Souza"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Telefone / WhatsApp *
                        </label>
                        <input
                          type="text"
                          required
                          value={guardianPhone}
                          onChange={(e) => setGuardianPhone(e.target.value)}
                          placeholder="(11) 99999-9999"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          CPF do Responsável
                        </label>
                        <input
                          type="text"
                          value={guardianCpf}
                          onChange={(e) => setGuardianCpf(e.target.value)}
                          placeholder="000.000.000-00"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Parentesco
                        </label>
                        <select
                          value={guardianRelationship}
                          onChange={(e) => setGuardianRelationship(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none bg-white"
                        >
                          <option value="Mãe">Mãe</option>
                          <option value="Pai">Pai</option>
                          <option value="Avó/Avô">Avó/Avô</option>
                          <option value="Tutor/Legal">Tutor / Responsável Legal</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Convênio & Guia Autorizada */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 border-b pb-1">
                      3. Plano de Saúde & Guia Autorizada
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Plano de Saúde *
                        </label>
                        <select
                          required
                          value={insurerId}
                          onChange={(e) => setInsurerId(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none bg-white"
                        >
                          {insurers.length === 0 && <option value="">Selecione o plano de saúde</option>}
                          {insurers.map((ins) => (
                            <option key={ins.id} value={ins.id}>
                              {ins.name || ins.full_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Nome do Plano (Ex: Amil 400)
                        </label>
                        <input
                          type="text"
                          value={planName}
                          onChange={(e) => setPlanName(e.target.value)}
                          placeholder="Nome do plano"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Número da Carteirinha
                        </label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="Nº de carteirinha"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Número da Guia Autorizada *
                        </label>
                        <input
                          type="text"
                          required
                          value={guideNumber}
                          onChange={(e) => setGuideNumber(e.target.value)}
                          placeholder="Nº da Guia impressa"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Código do Procedimento
                        </label>
                        <input
                          type="text"
                          value={procedureCode}
                          onChange={(e) => setProcedureCode(e.target.value)}
                          placeholder="Ex: 40101010"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Sessões Autorizadas
                        </label>
                        <input
                          type="number"
                          value={sessionsAuthorized}
                          onChange={(e) => setSessionsAuthorized(Number(e.target.value))}
                          placeholder="10"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Senha / Cód. Autorização
                        </label>
                        <input
                          type="text"
                          value={authorizationPassword}
                          onChange={(e) => setAuthorizationPassword(e.target.value)}
                          placeholder="Senha da guia (opcional)"
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Validade da Guia (Até)
                        </label>
                        <input
                          type="date"
                          value={validTo}
                          onChange={(e) => setValidTo(e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Checklist de Documentos Físicos */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <span>📄</span> Documentos Físicos Apresentados pelo Cliente (Recepção)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={printedDocsChecked}
                          onChange={(e) => setPrintedDocsChecked(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>Documentos Impressos</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={medicalLaudoChecked}
                          onChange={(e) => setMedicalLaudoChecked(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>Laudo Médico Impresso</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={authorizedGuideChecked}
                          onChange={(e) => setAuthorizedGuideChecked(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>Guia Autorizada</span>
                      </label>
                    </div>
                  </div>

                  {/* Agendamento Imediato */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-800">
                      <input
                        type="checkbox"
                        checked={scheduleNow}
                        onChange={(e) => setScheduleNow(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                      />
                      <span>🗓️ Agendar 1ª Avaliação agora mesmo na Recepção</span>
                    </label>
                    <p className="text-xs text-slate-500 pl-6">
                      Marque esta opção para definir a data de agendamento no ato do atendimento presencial.
                    </p>

                    {scheduleNow && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Avaliador / Terapeuta *
                          </label>
                          <select
                            value={selectedTherapistId}
                            onChange={(e) => setSelectedTherapistId(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none bg-white"
                          >
                            {therapists.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.full_name || t.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Sala de Atendimento *
                          </label>
                          <select
                            value={selectedRoomId}
                            onChange={(e) => setSelectedRoomId(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none bg-white"
                          >
                            {evaluationRooms.length === 0 ? (
                              <option value="">Nenhuma sala de avaliação cadastrada</option>
                            ) : (
                              evaluationRooms.map((r: OptionItem) => (
                                <option key={r.id} value={r.id}>
                                  {r.name || r.full_name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Data da Avaliação *
                          </label>
                          <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Horário *
                          </label>
                          <input
                            type="time"
                            value={selectedTime}
                            onChange={(e) => setSelectedTime(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-amber-500 focus:outline-none bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submit buttons */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-md bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
                    >
                      {loading ? "Cadastrando..." : scheduleNow ? "Cadastrar & Agendar 1ª Avaliação" : "Cadastrar & Enviar ao Supervisor"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
