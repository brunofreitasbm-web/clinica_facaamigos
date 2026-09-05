"use client";

import { useState } from "react";
import { FaturamentoHeader } from "../faturamento-header";
import { generateTissXml, TissGuiaItem } from "@/lib/tiss/xml-builder";

const MOCK_GUIAS: TissGuiaItem[] = [
  {
    id: "g-1",
    numeroGuiaPrestador: "202608001",
    numeroCarteira: "002789123456001",
    nomeBeneficiario: "Gabriel Santos Silva",
    codigoConvenio: "UNIMED_SP",
    nomeConvenio: "Unimed Central",
    procedimentoCodigo: "50000147",
    procedimentoDescricao: "Sessão de Terapia Ocupacional em Autismo (ABA)",
    dataAtendimento: "2026-08-03",
    valorTotal: 180.0,
  },
  {
    id: "g-2",
    numeroGuiaPrestador: "202608002",
    numeroCarteira: "002789123456002",
    nomeBeneficiario: "Lucas Oliveira Souza",
    codigoConvenio: "BRADESCO_SAUDE",
    nomeConvenio: "Bradesco Saúde",
    procedimentoCodigo: "50000155",
    procedimentoDescricao: "Atendimento de Fonoaudiologia Neurofuncional",
    dataAtendimento: "2026-08-04",
    valorTotal: 195.0,
  },
  {
    id: "g-3",
    numeroGuiaPrestador: "202608003",
    numeroCarteira: "002789123456003",
    nomeBeneficiario: "Beatriz Lima Pereira",
    codigoConvenio: "SULAMERICA",
    nomeConvenio: "SulAmérica Saúde",
    procedimentoCodigo: "50000163",
    procedimentoDescricao: "Sessão de Psicopedagogia / Análise do Comportamento",
    dataAtendimento: "2026-08-05",
    valorTotal: 210.0,
  },
  {
    id: "g-4",
    numeroGuiaPrestador: "202608004",
    numeroCarteira: "002789123456004",
    nomeBeneficiario: "Sophia Almeida",
    codigoConvenio: "UNIMED_SP",
    nomeConvenio: "Unimed Central",
    procedimentoCodigo: "50000147",
    procedimentoDescricao: "Sessão de Terapia Ocupacional em Autismo (ABA)",
    dataAtendimento: "2026-08-07",
    valorTotal: 180.0,
  },
];

export default function GuiasTissPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>(["g-1", "g-2", "g-3", "g-4"]);
  const [convenioFilter, setConvenioFilter] = useState<string>("todos");
  const [generatedXml, setGeneratedXml] = useState<string | null>(null);

  const filteredGuias = MOCK_GUIAS.filter(
    (g) => convenioFilter === "todos" || g.codigoConvenio === convenioFilter
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleGenerateXml = () => {
    const selectedGuias = MOCK_GUIAS.filter((g) => selectedIds.includes(g.id));
    if (selectedGuias.length === 0) {
      alert("Selecione pelo menos uma guia para faturamento.");
      return;
    }

    const loteXml = generateTissXml({
      numeroLote: `LOTE-${Date.now().toString().slice(-6)}`,
      codigoPrestador: "12345678",
      nomePrestador: "Instituto FaçaAmigos de Desenvolvimento Infantil",
      cnpjPrestador: "12.345.678/0001-99",
      registroAns: "354128",
      dataCriacao: new Date().toISOString(),
      guias: selectedGuias,
    });

    setGeneratedXml(loteXml);
  };

  const handleDownload = () => {
    if (!generatedXml) return;
    const blob = new Blob([generatedXml], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lote_tiss_facaamigos_${new Date().toISOString().slice(0, 10)}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalValorSelected = MOCK_GUIAS.filter((g) => selectedIds.includes(g.id)).reduce(
    (acc, item) => acc + item.valorTotal,
    0
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <FaturamentoHeader active="guias" />

      <main className="mx-auto max-w-7xl px-8 py-8 space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-paper-line pb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: "var(--font-heading)" }}>
              Faturamento TISS (Guias & Lotes XML)
            </h1>
            <p className="text-sm text-ink-soft">
              Geração automatizada de guias SP-SADT no padrão ANS 3.05.00 para exportação às operadoras.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateXml}
              className="inline-flex items-center gap-2 rounded-md bg-chart px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-chart-strong transition-colors"
            >
              ⚡ Gerar Lote XML ({selectedIds.length} Guias)
            </button>
          </div>
        </div>

        {/* Painel de Filtros e Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-paper-line bg-paper p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Guias Selecionadas</span>
            <div className="text-2xl font-semibold text-chart tabular-nums mt-1 font-mono">
              {selectedIds.length} <span className="text-xs text-ink-soft font-normal font-sans">/ {MOCK_GUIAS.length}</span>
            </div>
          </div>

          <div className="rounded-lg border border-paper-line bg-paper p-4 shadow-sm">
            <span className="text-xs font-medium text-ink-faint uppercase">Valor Total do Lote</span>
            <div className="text-2xl font-semibold text-status-positive tabular-nums mt-1 font-mono">
              R$ {totalValorSelected.toFixed(2)}
            </div>
          </div>

          <div className="md:col-span-2 rounded-lg border border-paper-line bg-paper p-4 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-xs font-medium text-ink-faint">Filtrar por Operadora/Convenio:</label>
              <select
                value={convenioFilter}
                onChange={(e) => setConvenioFilter(e.target.value)}
                className="block w-full rounded-md border border-paper-line-strong bg-white px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-chart"
              >
                <option value="todos">Todos os Convênios</option>
                <option value="UNIMED_SP">Unimed Central</option>
                <option value="BRADESCO_SAUDE">Bradesco Saúde</option>
                <option value="SULAMERICA">SulAmérica Saúde</option>
              </select>
            </div>

            <div className="text-right text-xs text-ink-soft">
              Padrão ANS: <span className="font-semibold text-ink">TISS v3.05.00</span>
            </div>
          </div>
        </div>

        {/* Tabela de Guias */}
        <div className="rounded-lg border border-paper-line-strong bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink">
              <thead className="bg-paper border-b border-paper-line text-ink-faint font-medium uppercase">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredGuias.length && filteredGuias.length > 0}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? filteredGuias.map((g) => g.id) : [])
                      }
                      className="rounded border-paper-line-strong"
                    />
                  </th>
                  <th className="p-3.5">Nº Guia Prestador</th>
                  <th className="p-3.5">Paciente / Beneficiário</th>
                  <th className="p-3.5">Convênio & Carteira</th>
                  <th className="p-3.5">Procedimento TUSS</th>
                  <th className="p-3.5">Data Sessão</th>
                  <th className="p-3.5 text-right">Valor (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {filteredGuias.map((guia) => (
                  <tr key={guia.id} className="hover:bg-paper/60 transition-colors">
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(guia.id)}
                        onChange={() => toggleSelect(guia.id)}
                        className="rounded border-paper-line-strong"
                      />
                    </td>
                    <td className="p-3.5 font-mono font-medium text-chart">{guia.numeroGuiaPrestador}</td>
                    <td className="p-3.5 font-semibold text-ink">{guia.nomeBeneficiario}</td>
                    <td className="p-3.5">
                      <div className="font-medium">{guia.nomeConvenio}</div>
                      <div className="text-[11px] font-mono text-ink-soft">{guia.numeroCarteira}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono text-[11px] text-chart font-semibold">{guia.procedimentoCodigo}</div>
                      <div className="text-ink-soft">{guia.procedimentoDescricao}</div>
                    </td>
                    <td className="p-3.5 font-mono">{guia.dataAtendimento}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-status-positive">
                      R$ {guia.valorTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal/Preview do XML Gerado */}
        {generatedXml && (
          <div className="rounded-lg border border-status-positive bg-status-positive-soft/30 p-6 space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-status-positive-text">
                  ✅ Arquivo XML TISS Gerado com Sucesso!
                </h3>
                <p className="text-xs text-ink-soft">
                  O arquivo XML está validado e pronto para envio no portal da operadora.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownload}
                  className="rounded-md bg-status-positive px-4 py-2 text-xs font-semibold text-white hover:bg-status-positive-text transition-colors"
                >
                  📥 Baixar Arquivo XML TISS
                </button>
                <button
                  onClick={() => setGeneratedXml(null)}
                  className="rounded-md border border-paper-line-strong bg-white px-3 py-2 text-xs font-medium text-ink hover:bg-paper"
                >
                  Fechar Visualização
                </button>
              </div>
            </div>

            <pre className="max-h-60 overflow-y-auto rounded-md bg-ink p-4 text-[11px] text-paper font-mono leading-relaxed">
              {generatedXml}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
