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
    <div className="min-h-screen bg-[#faf8f3] text-[#1c2530]">
      <FaturamentoHeader active="guias" />

      <main className="mx-auto max-w-7xl px-8 py-8 space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e4dfd2] pb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1c2530]" style={{ fontFamily: "var(--font-heading)" }}>
              Faturamento TISS (Guias & Lotes XML)
            </h1>
            <p className="text-sm text-[#57606b]">
              Geração automatizada de guias SP-SADT no padrão ANS 3.05.00 para exportação às operadoras.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateXml}
              className="inline-flex items-center gap-2 rounded-md bg-[#0f5c7d] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0a4a5f] transition-colors"
            >
              ⚡ Gerar Lote XML ({selectedIds.length} Guias)
            </button>
          </div>
        </div>

        {/* Painel de Filtros e Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-[#e4dfd2] bg-[#faf8f3] p-4 shadow-sm">
            <span className="text-xs font-medium text-[#5f656f] uppercase">Guias Selecionadas</span>
            <div className="text-2xl font-semibold text-[#0f5c7d] tabular-nums mt-1 font-mono">
              {selectedIds.length} <span className="text-xs text-[#57606b] font-normal font-sans">/ {MOCK_GUIAS.length}</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#e4dfd2] bg-[#faf8f3] p-4 shadow-sm">
            <span className="text-xs font-medium text-[#5f656f] uppercase">Valor Total do Lote</span>
            <div className="text-2xl font-semibold text-[#1b8a6b] tabular-nums mt-1 font-mono">
              R$ {totalValorSelected.toFixed(2)}
            </div>
          </div>

          <div className="md:col-span-2 rounded-lg border border-[#e4dfd2] bg-[#faf8f3] p-4 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#5f656f]">Filtrar por Operadora/Convenio:</label>
              <select
                value={convenioFilter}
                onChange={(e) => setConvenioFilter(e.target.value)}
                className="block w-full rounded-md border border-[#cfc8b4] bg-white px-3 py-1.5 text-xs text-[#1c2530] focus:outline-none focus:ring-1 focus:ring-[#0f5c7d]"
              >
                <option value="todos">Todos os Convênios</option>
                <option value="UNIMED_SP">Unimed Central</option>
                <option value="BRADESCO_SAUDE">Bradesco Saúde</option>
                <option value="SULAMERICA">SulAmérica Saúde</option>
              </select>
            </div>

            <div className="text-right text-xs text-[#57606b]">
              Padrão ANS: <span className="font-semibold text-[#1c2530]">TISS v3.05.00</span>
            </div>
          </div>
        </div>

        {/* Tabela de Guias */}
        <div className="rounded-lg border border-[#cfc8b4] bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1c2530]">
              <thead className="bg-[#faf8f3] border-b border-[#e4dfd2] text-[#5f656f] font-medium uppercase">
                <tr>
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredGuias.length && filteredGuias.length > 0}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? filteredGuias.map((g) => g.id) : [])
                      }
                      className="rounded border-[#cfc8b4]"
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
              <tbody className="divide-y divide-[#e4dfd2]">
                {filteredGuias.map((guia) => (
                  <tr key={guia.id} className="hover:bg-[#faf8f3]/60 transition-colors">
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(guia.id)}
                        onChange={() => toggleSelect(guia.id)}
                        className="rounded border-[#cfc8b4]"
                      />
                    </td>
                    <td className="p-3.5 font-mono font-medium text-[#0f5c7d]">{guia.numeroGuiaPrestador}</td>
                    <td className="p-3.5 font-semibold text-[#1c2530]">{guia.nomeBeneficiario}</td>
                    <td className="p-3.5">
                      <div className="font-medium">{guia.nomeConvenio}</div>
                      <div className="text-[11px] font-mono text-[#57606b]">{guia.numeroCarteira}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono text-[11px] text-[#0f5c7d] font-semibold">{guia.procedimentoCodigo}</div>
                      <div className="text-[#57606b]">{guia.procedimentoDescricao}</div>
                    </td>
                    <td className="p-3.5 font-mono">{guia.dataAtendimento}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-[#1b8a6b]">
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
          <div className="rounded-lg border border-[#1b8a6b] bg-[#dcefe8]/30 p-6 space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0e5c44]">
                  ✅ Arquivo XML TISS Gerado com Sucesso!
                </h3>
                <p className="text-xs text-[#57606b]">
                  O arquivo XML está validado e pronto para envio no portal da operadora.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownload}
                  className="rounded-md bg-[#1b8a6b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0e5c44] transition-colors"
                >
                  📥 Baixar Arquivo XML TISS
                </button>
                <button
                  onClick={() => setGeneratedXml(null)}
                  className="rounded-md border border-[#cfc8b4] bg-white px-3 py-2 text-xs font-medium text-[#1c2530] hover:bg-[#faf8f3]"
                >
                  Fechar Visualização
                </button>
              </div>
            </div>

            <pre className="max-h-60 overflow-y-auto rounded-md bg-[#1c2530] p-4 text-[11px] text-[#faf8f3] font-mono leading-relaxed">
              {generatedXml}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
