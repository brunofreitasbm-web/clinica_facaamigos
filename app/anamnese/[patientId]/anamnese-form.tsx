"use client";

import { useState } from "react";
import { submitAnamnese } from "./actions";
import { Heart, User, MapPin, Phone, Mail, FileText, CheckCircle2 } from "lucide-react";

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
      setError(result.error || "Ocorreu um erro ao enviar os dados. Tente novamente.");
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12 px-4 text-center animate-in fade-in zoom-in duration-500">
        <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900">Tudo Certo, Família!</h3>
        <p className="text-gray-600 max-w-md">
          Agradecemos de coração por compartilhar essas informações. Elas serão cuidadas com muito carinho e são fundamentais para o sucesso do primeiro acolhimento do(a) <strong className="text-indigo-600">{patient.name}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10 mt-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Seção 1: Dados do Paciente */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
            <User className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800">1. Dados da Criança/Paciente</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo do(a) paciente *</label>
            <input required type="text" name="nome_paciente" defaultValue={patient.name} className="block w-full rounded-xl border-gray-200 bg-gray-50 p-3 text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento *</label>
            <input required type="date" name="data_nascimento" className="block w-full rounded-xl border-gray-200 bg-gray-50 p-3 text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Idade *</label>
            <input required type="text" name="idade" placeholder="Ex: 4 anos e 2 meses" className="block w-full rounded-xl border-gray-200 bg-gray-50 p-3 text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
          </div>
        </div>
      </section>

      {/* Seção 2: Responsáveis */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <Heart className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800">2. Responsáveis & Contato</h3>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Estes dados atualizarão automaticamente o cadastro da família no sistema da clínica.
        </p>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Mãe (ou Responsável 1)</label>
            <input type="text" name="nome_mae" className="block w-full rounded-xl border-gray-200 bg-gray-50 p-3 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp da Mãe</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input type="tel" name="whatsapp_mae" placeholder="(00) 00000-0000" className="block w-full pl-10 rounded-xl border-gray-200 bg-gray-50 p-3 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Pai (ou Responsável 2)</label>
            <input type="text" name="nome_pai" className="block w-full rounded-xl border-gray-200 bg-gray-50 p-3 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp do Pai</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input type="tel" name="whatsapp_pai" placeholder="(00) 00000-0000" className="block w-full pl-10 rounded-xl border-gray-200 bg-gray-50 p-3 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail principal</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input type="email" name="email" className="block w-full pl-10 rounded-xl border-gray-200 bg-gray-50 p-3 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço completo (Rua, Número, Bairro, Cidade)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input type="text" name="endereco" className="block w-full pl-10 rounded-xl border-gray-200 bg-gray-50 p-3 text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
            </div>
          </div>
        </div>
      </section>

      {/* Seção 3: Queixa Principal */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800">3. O que nos traz aqui hoje?</h3>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Qual o motivo principal da busca pelo atendimento? *
          </label>
          <textarea 
            required 
            name="queixa_principal" 
            rows={5} 
            className="block w-full rounded-xl border-gray-200 bg-gray-50 p-4 text-gray-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none" 
            placeholder="Sinta-se à vontade para detalhar..."
          ></textarea>
        </div>
      </section>

      {/* Submit */}
      <div className="pt-6 pb-12 flex justify-center sm:justify-end">
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100 transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-pulse">Enviando com segurança...</span>
          ) : (
            <>
              Finalizar e Enviar
              <Heart className="h-5 w-5 fill-white" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
