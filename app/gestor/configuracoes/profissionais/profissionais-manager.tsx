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

  const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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
          {/* Tiers de Valor-Hora */}
          <div className="flex flex-col gap-4 rounded-xl border border-paper-line bg-paper-panel p-6 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-semibold text-ink-strong">Faixas de Remuneração PJ (Tiers de Valor-Hora)</h3>
                <p className="text-xs text-ink-faint">Tabela de contrato utilizada para cálculo de repasse por sessão (PRD §0 e §7).</p>
              </div>
              <button onClick={() => alert("Criar nova faixa de contrato")} className="button button-primary">
                + Nova Faixa
              </button>
            </div>

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
              <button onClick={() => alert("Requisitos de profissionais atualizados com sucesso!")} className="button button-primary">
                Salvar Configurações de Profissionais
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
