"use client";

import { useState } from "react";

export type IntakeChecklistStatus = {
  pedidoMedico: boolean;
  carteirinha: boolean;
  docResponsavel: boolean;
  termoLgpd: boolean;
  termoImagem: boolean;
  contrato: boolean;
};

export function ChecklistEntradaDialog({ patientName }: { patientName?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<IntakeChecklistStatus>({
    pedidoMedico: false,
    carteirinha: false,
    docResponsavel: false,
    termoLgpd: false,
    termoImagem: false,
    contrato: false,
  });

  const toggleItem = (key: keyof IntakeChecklistStatus) => {
    setItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const completedCount = Object.values(items).filter(Boolean).length;
  const isComplete = completedCount === 6;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
      >
        📋 Checklist de Entrada
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <h3 style={{ fontFamily: "var(--font-heading)" }} className="text-base font-bold text-neutral-900">
                  Checklist de Entrada {patientName ? `· ${patientName}` : ""}
                </h3>
                <p className="text-xs text-neutral-500">
                  Documentos obrigatórios do fluxo de admissão
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-lg bg-neutral-100 p-3">
              <span className="text-xs font-semibold text-neutral-700">Progresso dos Anexos</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isComplete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {completedCount} de 6 Concluídos
              </span>
            </div>

            <div className="space-y-2.5">
              <label className="flex items-center gap-3 rounded-md border p-2.5 text-xs hover:bg-neutral-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={items.pedidoMedico}
                  onChange={() => toggleItem("pedidoMedico")}
                  className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
                />
                <div>
                  <span className="font-semibold text-neutral-800">1. Pedido Médico com CID</span>
                  <p className="text-[11px] text-neutral-500">Exigência para faturamento e laudo inicial</p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-md border p-2.5 text-xs hover:bg-neutral-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={items.carteirinha}
                  onChange={() => toggleItem("carteirinha")}
                  className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
                />
                <div>
                  <span className="font-semibold text-neutral-800">2. Carteirinha do Convênio</span>
                  <p className="text-[11px] text-neutral-500">Frente e verso visíveis com validade</p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-md border p-2.5 text-xs hover:bg-neutral-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={items.docResponsavel}
                  onChange={() => toggleItem("docResponsavel")}
                  className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
                />
                <div>
                  <span className="font-semibold text-neutral-800">3. Documento do Responsável (RG/CPF)</span>
                  <p className="text-[11px] text-neutral-500">Comprovação de vínculo com a criança</p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-md border p-2.5 text-xs hover:bg-neutral-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={items.termoLgpd}
                  onChange={() => toggleItem("termoLgpd")}
                  className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
                />
                <div>
                  <span className="font-semibold text-neutral-800">4. Termo LGPD Assinado</span>
                  <p className="text-[11px] text-neutral-500">Consentimento para tratamento de dados sensíveis</p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-md border p-2.5 text-xs hover:bg-neutral-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={items.termoImagem}
                  onChange={() => toggleItem("termoImagem")}
                  className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
                />
                <div>
                  <span className="font-semibold text-neutral-800">5. Termo de Uso de Imagem Assinado</span>
                  <p className="text-[11px] text-neutral-500">Autorização para gravações clínicas/pedagógicas</p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-md border p-2.5 text-xs hover:bg-neutral-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={items.contrato}
                  onChange={() => toggleItem("contrato")}
                  className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
                />
                <div>
                  <span className="font-semibold text-neutral-800">6. Contrato de Prestação de Serviços</span>
                  <p className="text-[11px] text-neutral-500">Assinatura do contrato de adesão clínica</p>
                </div>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
