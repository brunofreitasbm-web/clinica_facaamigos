"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ConfigSidebar } from "../config-sidebar";

interface TierItem {
  id: string;
  name: string;
  hourlyRate: number;
  description: string;
}

const INITIAL_TIERS: TierItem[] = [
  { id: "t-1", name: "Tier 1 - Aplicador / Junior", hourlyRate: 45.0, description: "Terapeuta em formação ou aplicador supervisionado." },
  { id: "t-2", name: "Tier 2 - Terapeuta Pleno", hourlyRate: 65.0, description: "Profissional com 2+ anos de experiência e certificação básica." },
  { id: "t-3", name: "Tier 3 - Terapeuta Senior", hourlyRate: 85.0, description: "Profissional com pós-graduação e 5+ anos em intervenção TEA." },
  { id: "t-4", name: "Tier 4 - Supervisor / Especialista ESDM", hourlyRate: 110.0, description: "Supervisor de casos com certificação em protocolos específicos." },
];

export function ProfissionaisManager() {
  const [tiers, setTiers] = useState<TierItem[]>(INITIAL_TIERS);
  const [exigirConselhoAtivo, setExigirConselhoAtivo] = useState(true);
  const [travaEsdmDenver, setTravaEsdmDenver] = useState(true);
  const [savedAlert, setSavedAlert] = useState(false);

  const [isAddingTier, setIsAddingTier] = useState(false);
  const [newTierName, setNewTierName] = useState("");
  const [newTierRate, setNewTierRate] = useState<number>(50);
  const [newTierDesc, setNewTierDesc] = useState("");

  const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  const handleAddTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTierName) return;
    setTiers((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        name: newTierName,
        hourlyRate: newTierRate,
        description: newTierDesc,
      },
    ]);
    setNewTierName("");
    setNewTierRate(50);
    setNewTierDesc("");
    setIsAddingTier(false);
  };

  const handleSaveAll = () => {
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 3000);
  };

  return (
    <>
      <ConfigSidebar active="profissionais" />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <PageHeader
          axisLabel="Configurações"
          title="Profissionais & Tiers"
          description="Tabelas de faixas de valor-hora, requisitos de conselho de classe e certificações exigidas."
        />

        <div className="flex flex-col gap-8 p-6 sm:p-10 max-w-4xl">
          {savedAlert && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Configurações de profissionais e faixas de remuneração salvas com sucesso!
            </div>
          )}

          {/* Tiers de Valor-Hora */}
          <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-ink-strong">Faixas de Remuneração PJ (Tiers de Valor-Hora)</h3>
                <p className="text-xs text-ink-faint">Tabela de contrato utilizada para cálculo de repasse por sessão (PRD §0 e §7).</p>
              </div>
              <button onClick={() => setIsAddingTier(true)} className="button button-primary">
                + Nova Faixa
              </button>
            </div>

            {isAddingTier && (
              <form onSubmit={handleAddTier} className="flex flex-col gap-3 p-4 rounded-lg bg-paper-line/30 border border-paper-line mt-2">
                <h4 className="text-xs font-semibold text-ink-strong">Cadastrar Nova Faixa (Tier)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Nome da faixa (ex: Tier 5)"
                    className="input text-xs"
                    value={newTierName}
                    onChange={(e) => setNewTierName(e.target.value)}
                  />
                  <input
                    type="number"
                    required
                    placeholder="Valor-hora (R$)"
                    className="input text-xs"
                    value={newTierRate}
                    onChange={(e) => setNewTierRate(Number(e.target.value))}
                  />
                  <input
                    type="text"
                    placeholder="Descrição da qualificação"
                    className="input text-xs"
                    value={newTierDesc}
                    onChange={(e) => setNewTierDesc(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setIsAddingTier(false)} className="button button-outline text-xs">
                    Cancelar
                  </button>
                  <button type="submit" className="button button-primary text-xs">
                    Salvar Faixa
                  </button>
                </div>
              </form>
            )}

            <table className="table mt-2">
              <thead>
                <tr>
                  <th>Nível / Tier</th>
                  <th>Valor-Hora de Repasse</th>
                  <th>Descrição da Qualificação</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.id}>
                    <td className="font-semibold text-sm">{t.name}</td>
                    <td className="font-bold tabular-figure text-accent">{currencyFormatter.format(t.hourlyRate)}/h</td>
                    <td className="text-xs text-ink-faint">{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Regras e Certificações */}
          <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
            <h3 className="text-base font-semibold text-ink-strong">Requisitos de Registro & Certificação</h3>
            <p className="text-xs text-ink-faint">Travas automáticas do sistema para conformidade regulatória e clínica.</p>

            <div className="flex flex-col gap-4 mt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-paper-line text-accent focus:ring-accent"
                  checked={exigirConselhoAtivo}
                  onChange={(e) => setExigirConselhoAtivo(e.target.checked)}
                />
                <span className="text-sm font-medium text-ink-strong">
                  Exigir obrigatoriamente conselho profissional ativo no cadastro (CRP, CREFITO, CRFa, CRM)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-paper-line text-accent focus:ring-accent"
                  checked={travaEsdmDenver}
                  onChange={(e) => setTravaEsdmDenver(e.target.checked)}
                />
                <span className="text-sm font-medium text-ink-strong">
                  Trava de segurança ESDM/Denver: restringir visualização e aplicação de itens Denver/ESDM apenas a terapeutas com flag <code className="text-xs bg-paper-line px-1 rounded">esdm_certified = true</code> (PRD §7.1)
                </span>
              </label>
            </div>

            <div className="pt-4 border-t border-paper-line flex justify-end">
              <button onClick={handleSaveAll} className="button button-primary">
                Salvar Configurações de Profissionais
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
