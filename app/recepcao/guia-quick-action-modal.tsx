"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { registerAuthorization, getInsurersList } from "@/app/recepcao/pacientes/[id]/stage-actions";
import { linkAuthorizationToAppointment, getPatientActiveAuthorizations, type PatientAuthorizationOption } from "./agenda/session-actions";
import { FileText, Plus, Check, X, AlertCircle, Calendar, Hash, ShieldCheck } from "lucide-react";

interface GuiaQuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  appointmentId?: string;
  onSuccess?: () => void;
}

export function GuiaQuickActionModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  appointmentId,
  onSuccess,
}: GuiaQuickActionModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Guias ativas registradas
  const [activeGuides, setActiveGuides] = useState<PatientAuthorizationOption[] | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState("");

  // Alterna a exibição do formulário de cadastro de nova guia
  const [showAddForm, setShowAddForm] = useState(false);

  // Lista de convênios cadastrados
  const [insurers, setInsurers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen && patientId) {
      setError(null);
      setSuccessMsg(null);
      // Carregar guias do paciente
      getPatientActiveAuthorizations(patientId).then((guides) => {
        setActiveGuides(guides);
        // Se não tiver guias ativas ainda, abre direto o formulário de cadastro
        if (guides.length === 0) {
          setShowAddForm(true);
        } else {
          setShowAddForm(false);
        }
      });
      // Carregar convênios
      getInsurersList().then(setInsurers);
    }
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  function handleLinkExisting(guideIdToLink: string) {
    if (!appointmentId || !guideIdToLink) return;

    setError(null);
    startTransition(async () => {
      const res = await linkAuthorizationToAppointment(appointmentId, guideIdToLink);
      if (res.success) {
        setSuccessMsg("Guia vinculada a esta sessão com sucesso!");
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1000);
      } else {
        setError(res.error);
      }
    });
  }

  function handleCreateNew(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await registerAuthorization(patientId, formData);
      if (res.success) {
        setSuccessMsg("Guia adicionada com sucesso!");
        
        // Recarregar a lista de guias adicionadas
        const updatedGuides = await getPatientActiveAuthorizations(patientId);
        setActiveGuides(updatedGuides);

        // Se estiver vinculando a uma sessão que não tinha guia, vincula a nova guia criada automaticamente
        if (appointmentId && updatedGuides.length > 0) {
          const latestGuide = updatedGuides[updatedGuides.length - 1];
          await linkAuthorizationToAppointment(appointmentId, latestGuide.id);
        }

        // Limpar o formulário para permitir adicionar mais uma se quiser ("e assim sucessivamente")
        formRef.current?.reset();
        setShowAddForm(false);

        setTimeout(() => {
          setSuccessMsg(null);
        }, 3000);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl border border-paper-line bg-paper shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-paper-line p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart/10 text-chart">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">Gestão de Guias do Paciente</h3>
              <p className="text-xs text-ink-soft">Paciente: <strong className="text-ink">{patientName}</strong></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-line-strong hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic Alerts */}
        {error && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Check className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body - Scrollable */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Section: List of Added / Active Guides */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-chart" />
                Guias Cadastradas ({activeGuides ? activeGuides.length : 0})
              </h4>
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-chart hover:underline bg-chart/10 px-2.5 py-1 rounded-md transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar Mais Uma Guia
                </button>
              )}
            </div>

            {activeGuides === null ? (
              <p className="py-4 text-xs text-ink-faint text-center">Carregando guias cadastradas...</p>
            ) : activeGuides.length === 0 ? (
              <div className="rounded-lg border border-dashed border-paper-line-strong p-4 text-center bg-paper-line-strong/20">
                <p className="text-xs text-ink-faint">Nenhuma guia cadastrada para este paciente ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeGuides.map((g, index) => (
                  <div
                    key={g.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-paper-line-strong bg-paper-line-strong/20 p-3 transition-colors hover:border-chart/40"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink">Guia #{index + 1}: {g.guideNumber ?? "Sem Número"}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-chart/10 text-chart">
                          Proc: {g.procedureCode}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-ink-soft">
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3 text-ink-faint" />
                          Sessões: <strong>{g.sessionsUsed}/{g.sessionsAuthorized}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-ink-faint" />
                          Válida até: {g.validTo ? new Date(g.validTo).toLocaleDateString("pt-BR") : "Indefinido"}
                        </span>
                      </div>
                    </div>

                    {appointmentId && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleLinkExisting(g.id)}
                        className="btn btn-secondary text-xs self-start sm:self-center shrink-0"
                      >
                        Vincular a esta sessão
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Add New Guide Form */}
          {showAddForm && (
            <div className="rounded-xl border border-chart/30 bg-chart-soft/20 p-4 transition-all">
              <div className="flex items-center justify-between mb-3 border-b border-paper-line pb-2">
                <h5 className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-chart" /> Preencha para Cadastrar Guia
                </h5>
                {activeGuides && activeGuides.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs text-ink-faint hover:text-ink underline"
                  >
                    Ocultar Formulário
                  </button>
                )}
              </div>

              <form ref={formRef} action={handleCreateNew} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-ink-soft mb-1">Convênio *</label>
                    <select name="insurer_id" required className="input text-xs w-full">
                      <option value="">Selecione o Convênio</option>
                      {insurers.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-ink-soft mb-1">Nº da Guia</label>
                    <input
                      type="text"
                      name="guide_number"
                      placeholder="Ex: 987654321"
                      className="input text-xs w-full"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-ink-soft mb-1">Código Procedimento *</label>
                    <input
                      type="text"
                      name="procedure_code"
                      required
                      placeholder="Ex: 50000012"
                      className="input text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-ink-soft mb-1">Sessões Autorizadas *</label>
                    <input
                      type="number"
                      name="sessions_authorized"
                      required
                      min="1"
                      defaultValue="10"
                      className="input text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-ink-soft mb-1">Senha Autorização (Opcional)</label>
                    <input
                      type="text"
                      name="authorization_password"
                      placeholder="Senha do convênio"
                      className="input text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-ink-soft mb-1">Vigência De *</label>
                    <input
                      type="date"
                      name="valid_from"
                      required
                      defaultValue={new Date().toISOString().split("T")[0]}
                      className="input text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-ink-soft mb-1">Vigência Até *</label>
                    <input
                      type="date"
                      name="valid_to"
                      required
                      className="input text-xs w-full"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-paper-line pt-3 mt-3">
                  {activeGuides && activeGuides.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="btn btn-secondary text-xs"
                      disabled={isPending}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="btn btn-primary text-xs"
                  >
                    {isPending ? "Cadastrando..." : "Salvar Guia"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-paper-line p-4 bg-paper-line-strong/10">
          <button
            type="button"
            onClick={() => {
              onSuccess?.();
              onClose();
            }}
            className="btn btn-primary text-xs"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
