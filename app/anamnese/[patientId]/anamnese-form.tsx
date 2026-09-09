"use client";

import { useState } from "react";
import { submitAnamnese } from "./actions";

export function AnamneseForm({ patient }: { patient: any }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    const result = await submitAnamnese(patient.id, formData);
    setLoading(false);
    
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || "Ocorreu um erro ao enviar os dados.");
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-6 text-center">
        <h3 className="text-xl font-semibold mb-2">Formulário Enviado!</h3>
        <p>Agradecemos as informações. Elas serão fundamentais para o primeiro atendimento do(a) {patient.name}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <div className="bg-red-50 text-red-600 p-4 rounded-md">{error}</div>}

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">1. Queixa Principal</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700">Qual o motivo principal da busca pelo atendimento?</label>
          <textarea required name="queixa_principal" rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder="Descreva brevemente..."></textarea>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">2. Histórico Gestacional e Neonatal</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Houve alguma complicação na gravidez?</label>
            <input type="text" name="complicacoes_gravidez" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo de parto e intercorrências</label>
            <input type="text" name="tipo_parto" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder="Normal, Cesárea, Prematuro..." />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">3. Desenvolvimento Motor e Fala</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Com que idade sentou?</label>
            <input type="text" name="idade_sentou" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Com que idade andou?</label>
            <input type="text" name="idade_andou" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Com que idade falou as primeiras palavras?</label>
            <input type="text" name="idade_falou" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">4. Rotina e Hábitos</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700">Como é a rotina de sono e alimentação?</label>
          <textarea name="rotina_sono_alimentacao" rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Dinâmica familiar (Com quem mora, relacionamento com irmãos/cuidadores)</label>
          <textarea name="dinamica_familiar" rows={2} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"></textarea>
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition"
        >
          {loading ? "Enviando..." : "Enviar Anamnese"}
        </button>
      </div>
    </form>
  );
}
