"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { ConfigSidebar } from "../config-sidebar";

export function GeraisForm() {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [formData, setFormData] = useState({
    razaoSocial: "Clínica TEA & TDAH Integrada Ltda",
    nomeFantasia: "Clínica Faça Amigos",
    cnpj: "12.345.678/0001-90",
    inscricaoMunicipal: "123456-7",
    email: "contato@clinicafacaamigos.com.br",
    telefone: "(11) 98765-4321",
    endereco: "Av. Paulista, 1000, Cj. 501 - Bela Vista, São Paulo/SP",
    toleranciaAtrasoMinutos: 15,
    prazoEvolucaoHoras: 24,
    bloqueioSemGuia: true,
    avisoGuiaVencendoDias: 15,
    permitirProvisorio: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    startTransition(async () => {
      // Simulate saving setting updates
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    });
  };

  return (
    <>
      <ConfigSidebar active="gerais" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Gerais"
          description="Dados cadastrais da clínica e parâmetros operacionais globais do sistema."
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-8 p-6 sm:p-10 max-w-4xl">
          {saved && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between">
              <span>Configurações salvas com sucesso!</span>
            </div>
          )}

          {/* Seção 1: Dados Cadastrais */}
          <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
            <h3 className="text-base font-semibold text-ink-strong">Dados Cadastrais da Clínica</h3>
            <p className="text-xs text-ink-faint">Informações fiscais e de contato exibidas em documentos, laudos e recibos.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Razão Social</label>
                <input
                  type="text"
                  className="input"
                  value={formData.razaoSocial}
                  onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Nome Fantasia</label>
                <input
                  type="text"
                  className="input"
                  value={formData.nomeFantasia}
                  onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">CNPJ</label>
                <input
                  type="text"
                  className="input"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Inscrição Municipal</label>
                <input
                  type="text"
                  className="input"
                  value={formData.inscricaoMunicipal}
                  onChange={(e) => setFormData({ ...formData, inscricaoMunicipal: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">E-mail Oficial</label>
                <input
                  type="email"
                  className="input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Telefone / WhatsApp Comercial</label>
                <input
                  type="text"
                  className="input"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  required
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Endereço Completo</label>
                <input
                  type="text"
                  className="input"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Parâmetros Operacionais */}
          <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
            <h3 className="text-base font-semibold text-ink-strong">Parâmetros Operacionais & Regras Clínicas</h3>
            <p className="text-xs text-ink-faint">Regras do sistema que automatizam bloqueios, alertas e relatórios de conformidade.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Tolerância de atraso no check-in (minutos)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  className="input"
                  value={formData.toleranciaAtrasoMinutos}
                  onChange={(e) => setFormData({ ...formData, toleranciaAtrasoMinutos: Number(e.target.value) })}
                />
                <span className="text-[11px] text-ink-faint">Tempo máximo após o início da sessão antes de sinalizar atraso.</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Prazo limite para evolução de sessão (horas)</label>
                <input
                  type="number"
                  min={1}
                  max={72}
                  className="input"
                  value={formData.prazoEvolucaoHoras}
                  onChange={(e) => setFormData({ ...formData, prazoEvolucaoHoras: Number(e.target.value) })}
                />
                <span className="text-[11px] text-ink-faint">Regra do PRD: padrão de 24h para preenchimento de evolução sem alerta.</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-strong">Aviso prévio de vencimento de guia (dias)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="input"
                  value={formData.avisoGuiaVencendoDias}
                  onChange={(e) => setFormData({ ...formData, avisoGuiaVencendoDias: Number(e.target.value) })}
                />
                <span className="text-[11px] text-ink-faint">Alerta a recepção antes da guia de autorização expirar.</span>
              </div>

              <div className="flex flex-col gap-3 sm:col-span-2 pt-2 border-t border-paper-line">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-paper-line text-accent focus:ring-accent"
                    checked={formData.bloqueioSemGuia}
                    onChange={(e) => setFormData({ ...formData, bloqueioSemGuia: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-ink-strong">
                    Bloqueio rígido de agendamento sem guia vigente (Requisito PRD §3.1)
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-paper-line text-accent focus:ring-accent"
                    checked={formData.permitirProvisorio}
                    onChange={(e) => setFormData({ ...formData, permitirProvisorio: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-ink-strong">
                    Permitir agendamento provisório durante renovação de autorização
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="submit" className="button button-primary px-6" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar Configurações Gerais"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
