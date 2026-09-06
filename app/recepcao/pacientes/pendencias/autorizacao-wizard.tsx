"use client";

import React, { useState } from "react";

export interface AuthorizationItem {
  id: string;
  patientName: string;
  insurerName: string;
  specialty: string;
  authorizedHours: number;
  consumedHours: number;
  expiresAt: string;
  status: "regular" | "attention" | "critical";
  protocolNumber: string;
}

const MOCK_AUTHORIZATIONS: AuthorizationItem[] = [
  {
    id: "aut-1",
    patientName: "Gabriel Mendonça (8 anos)",
    insurerName: "Unimed TISS",
    specialty: "Psicologia ABA",
    authorizedHours: 40,
    consumedHours: 37,
    expiresAt: "2026-09-20",
    status: "critical",
    protocolNumber: "AUT-2026-9982",
  },
  {
    id: "aut-2",
    patientName: "Lucas T. Silva (5 anos)",
    insurerName: "Bradesco Saúde (Liminar)",
    specialty: "Fonoaudiologia Neuro",
    authorizedHours: 20,
    consumedHours: 18,
    expiresAt: "2026-09-28",
    status: "critical",
    protocolNumber: "AUT-2026-4411",
  },
  {
    id: "aut-3",
    patientName: "Sofia Rocha (6 anos)",
    insurerName: "Amil Saúde",
    specialty: "Terapia Ocupacional / Integração Sensorial",
    authorizedHours: 30,
    consumedHours: 21,
    expiresAt: "2026-10-15",
    status: "attention",
    protocolNumber: "AUT-2026-1029",
  },
  {
    id: "aut-4",
    patientName: "Matheus V. Lima (7 anos)",
    insurerName: "SulAmérica Reembolso",
    specialty: "Psicopedagogia ABA",
    authorizedHours: 50,
    consumedHours: 15,
    expiresAt: "2026-11-30",
    status: "regular",
    protocolNumber: "AUT-2026-7721",
  },
];

export function AutorizacaoWizard() {
  const [items, setItems] = useState<AuthorizationItem[]>(MOCK_AUTHORIZATIONS);
  const [selectedItem, setSelectedItem] = useState<AuthorizationItem | null>(null);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [justificationText, setJustificationText] = useState("");
  const [successToast, setSuccessToast] = useState(false);

  const openRenewalModal = (item: AuthorizationItem) => {
    setSelectedItem(item);
    setWizardStep(1);
    setJustificationText(
      `Solicitação de renovação do pacote de ${item.specialty} para o paciente ${item.patientName}. Progresso terapêutico satisfatório registrado nas evoluções recentes.`
    );
  };

  const closeModal = () => {
    setSelectedItem(null);
    setWizardStep(1);
  };

  const handleCompleteRenewal = () => {
    if (!selectedItem) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === selectedItem.id
          ? {
              ...i,
              authorizedHours: i.authorizedHours + 40,
              consumedHours: 0,
              status: "regular",
              expiresAt: "2026-12-31",
            }
          : i
      )
    );
    setSuccessToast(true);
    closeModal();
    setTimeout(() => setSuccessToast(false), 4000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* TOAST DE SUCESSO */}
      {successToast && (
        <div className="rounded-lg bg-emerald-600 text-white p-4 shadow-lg flex items-center justify-between transition-all">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <div>
              <p className="m-0 font-bold text-sm">Solicitação de Renovação Enviada com Sucesso!</p>
              <p className="m-0 text-xs text-emerald-100">
                O pacote de horas foi renovado e os relatórios clínicos foram anexados ao lote TISS.
              </p>
            </div>
          </div>
          <button onClick={() => setSuccessToast(false)} className="text-white bg-transparent border-0 font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* CABEÇALHO COM EXP EXPLICAÇÃO ANTI-ERRO */}
      <div className="rounded-xl border bg-surface p-6 shadow-sm" style={{ borderColor: "var(--color-divider)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="m-0 text-lg font-bold text-ink">Pacotes de Horas Autorizadas & Saldo TISS / Liminares</h3>
            <p className="m-0 text-xs text-ink-soft mt-1">
              Monitore o consumo em tempo real de cada paciente por especialidade. O sistema impede agendamentos quando o saldo atinge zero.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
            🔒 Saldo Verificado Via Smart Validation
          </span>
        </div>

        {/* LISTA DE PACIENTES E SALDOS */}
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const pct = Math.min(100, Math.round((item.consumedHours / item.authorizedHours) * 100));
            const isCritical = item.status === "critical" || pct >= 90;
            const isAttention = item.status === "attention" || (pct >= 70 && pct < 90);

            return (
              <div
                key={item.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-lg border p-4 transition-all hover:border-blue-300"
                style={{
                  borderColor: isCritical ? "rgba(239, 68, 68, 0.4)" : isAttention ? "rgba(245, 158, 11, 0.4)" : "var(--color-divider)",
                  backgroundColor: isCritical ? "rgba(239, 68, 68, 0.02)" : isAttention ? "rgba(245, 158, 11, 0.02)" : "var(--color-surface)",
                }}
              >
                <div className="flex flex-col gap-1 min-w-[280px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">{item.patientName}</span>
                    <span className="text-[11px] font-mono text-ink-faint bg-paper px-1.5 py-0.5 rounded">
                      {item.protocolNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-soft">
                    <span>🏥 {item.insurerName}</span>
                    <span>•</span>
                    <span className="font-medium text-blue-700">{item.specialty}</span>
                  </div>
                </div>

                {/* BARRA DE PROGRESSO DO CONSUMO DE SESSÕES */}
                <div className="flex-1 max-w-md">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-ink-soft">
                      Sessões Consumidas: <strong className="text-ink">{item.consumedHours}</strong> de {item.authorizedHours}h
                    </span>
                    <span
                      className={`font-bold ${
                        isCritical ? "text-red-700" : isAttention ? "text-amber-700" : "text-emerald-700"
                      }`}
                    >
                      {pct}% consumido
                    </span>
                  </div>
                  <div className="w-full bg-paper-line rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCritical ? "bg-red-600" : isAttention ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-ink-faint mt-1 flex justify-between">
                    <span>Validade da Guia: {item.expiresAt}</span>
                    {isCritical && <span className="font-bold text-red-700">🚨 Restam apenas {item.authorizedHours - item.consumedHours}h!</span>}
                  </div>
                </div>

                {/* BOTÃO DE AÇÃO GUIADA */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openRenewalModal(item)}
                    className={`px-4 py-2 text-xs font-bold rounded-lg border-0 cursor-pointer shadow-sm transition-all ${
                      isCritical
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : isAttention
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    Renovar Autorização (1 Clique)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL WIZARD PASSO A PASSO "ANTI-BURRO" */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl border bg-surface p-6 shadow-xl" style={{ borderColor: "var(--color-divider)" }}>
            <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: "var(--color-divider)" }}>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Wizard Anti-Erro · Passo {wizardStep} de 3</span>
                <h3 className="m-0 text-base font-bold text-ink">Renovação de Autorização TISS</h3>
              </div>
              <button onClick={closeModal} className="border-0 bg-transparent text-gray-500 hover:text-gray-800 text-lg cursor-pointer">
                ✕
              </button>
            </div>

            {/* PASSO 1: CONFIRMAÇÃO DOS DADOS DO PACIENTE */}
            {wizardStep === 1 && (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                  <p className="m-0 text-xs font-bold text-blue-900">Paciente Selecionado:</p>
                  <h4 className="m-0 text-sm font-bold text-blue-950 mt-0.5">{selectedItem.patientName}</h4>
                  <p className="m-0 text-xs text-blue-800 mt-1">
                    Convênio: <strong>{selectedItem.insurerName}</strong> | Especialidade: <strong>{selectedItem.specialty}</strong>
                  </p>
                </div>

                <div className="rounded-lg border p-4 text-xs text-ink-soft space-y-2 bg-paper/40">
                  <div className="flex justify-between">
                    <span>Pacote Atual:</span>
                    <strong className="text-ink">{selectedItem.authorizedHours} horas</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Sessões já realizadas e registradas:</span>
                    <strong className="text-ink">{selectedItem.consumedHours} horas</strong>
                  </div>
                  <div className="flex justify-between text-red-700 font-bold">
                    <span>Saldo Restante:</span>
                    <span>{selectedItem.authorizedHours - selectedItem.consumedHours} horas</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4 border-t pt-3">
                  <button onClick={closeModal} className="px-4 py-2 text-xs font-semibold text-ink-soft bg-paper rounded-lg border">
                    Cancelar
                  </button>
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg border-0 cursor-pointer"
                  >
                    Avançar para Relatórios Clinicos →
                  </button>
                </div>
              </div>
            )}

            {/* PASSO 2: ANEXAR EVOLUÇÕES E JUSTIFICATIVA */}
            {wizardStep === 2 && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink mb-1">
                    Justificativa Clínica e Plano Terapêutico (Compilado Automático):
                  </label>
                  <textarea
                    rows={4}
                    value={justificationText}
                    onChange={(e) => setJustificationText(e.target.value)}
                    className="w-full rounded-lg border p-3 text-xs text-ink font-sans bg-surface focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[11px] text-ink-faint mt-1 block">
                    Os relatórios de evolução das últimas 12 sessões serão anexados ao arquivo XML TISS automaticamente.
                  </span>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center gap-2">
                  <span>✅</span>
                  <span><strong>Checklist de Segurança:</strong> CID-10 validado, laudo médico ativo e equipe cadastrada.</span>
                </div>

                <div className="flex justify-between gap-3 mt-4 border-t pt-3">
                  <button onClick={() => setWizardStep(1)} className="px-4 py-2 text-xs font-semibold text-ink-soft bg-paper rounded-lg border">
                    ← Voltar
                  </button>
                  <button
                    onClick={() => setWizardStep(3)}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg border-0 cursor-pointer"
                  >
                    Avançar para Confirmação Final →
                  </button>
                </div>
              </div>
            )}

            {/* PASSO 3: CONFIRMAÇÃO E RENOVAÇÃO FINAL */}
            {wizardStep === 3 && (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
                  <h4 className="m-0 text-sm font-bold text-amber-950 mb-1">Confirmar Novo Pacote de Sessões</h4>
                  <p className="m-0">
                    Ao confirmar, uma nova autorização de <strong>40 horas</strong> será adicionada para {selectedItem.patientName} e o saldo será resetado.
                  </p>
                </div>

                <div className="flex justify-between gap-3 mt-4 border-t pt-3">
                  <button onClick={() => setWizardStep(2)} className="px-4 py-2 text-xs font-semibold text-ink-soft bg-paper rounded-lg border">
                    ← Voltar
                  </button>
                  <button
                    onClick={handleCompleteRenewal}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg border-0 cursor-pointer shadow-md"
                  >
                    🚀 Finalizar e Enviar Autorização
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
