/**
 * Gerador de Arquivos XML TISS (Padrão ANS 3.05.00 / SP-SADT)
 * Utilizado para exportação de lotes de guias para operadoras de plano de saúde.
 */

export interface TissGuiaItem {
  id: string;
  numeroGuiaPrestador: string;
  numeroCarteira: string;
  nomeBeneficiario: string;
  codigoConvenio: string;
  nomeConvenio: string;
  procedimentoCodigo: string;
  procedimentoDescricao: string;
  dataAtendimento: string; // YYYY-MM-DD
  valorTotal: number;
}

export interface TissLote {
  numeroLote: string;
  codigoPrestador: string;
  nomePrestador: string;
  cnpjPrestador: string;
  registroAns: string;
  dataCriacao: string; // ISO String
  guias: TissGuiaItem[];
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateTissXml(lote: TissLote): string {
  const valorTotalLote = lote.guias.reduce((acc, item) => acc + item.valorTotal, 0).toFixed(2);
  const dataFormatada = lote.dataCriacao.split("T")[0];

  const guiasXml = lote.guias
    .map(
      (g) => `
    <ans:guiaSP-SADT>
      <ans:cabecalhoGuia>
        <ans:registroANS>${escapeXml(lote.registroAns)}</ans:registroANS>
        <ans:numeroGuiaPrestador>${escapeXml(g.numeroGuiaPrestador)}</ans:numeroGuiaPrestador>
      </ans:cabecalhoGuia>
      <ans:dadosBeneficiario>
        <ans:numeroCarteira>${escapeXml(g.numeroCarteira)}</ans:numeroCarteira>
        <ans:nomeBeneficiario>${escapeXml(g.nomeBeneficiario)}</ans:nomeBeneficiario>
      </ans:dadosBeneficiario>
      <ans:procedimentosRealizados>
        <ans:procedimento>
          <ans:codigoProcedimento>${escapeXml(g.procedimentoCodigo)}</ans:codigoProcedimento>
          <ans:descricaoProcedimento>${escapeXml(g.procedimentoDescricao)}</ans:descricaoProcedimento>
          <ans:dataRealizacao>${escapeXml(g.dataAtendimento)}</ans:dataRealizacao>
          <ans:valorTotal>${g.valorTotal.toFixed(2)}</ans:valorTotal>
        </ans:procedimento>
      </ans:procedimentosRealizados>
      <ans:valorTotalGuia>${g.valorTotal.toFixed(2)}</ans:valorTotalGuia>
    </ans:guiaSP-SADT>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <ans:cabecalho>
    <ans:identificacaoTransacao>
      <ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>
      <ans:sequencialTransacao>${escapeXml(lote.numeroLote)}</ans:sequencialTransacao>
      <ans:dataRegistroTransacao>${dataFormatada}</ans:dataRegistroTransacao>
    </ans:identificacaoTransacao>
    <ans:origem>
      <ans:codigoPrestadorNaOperadora>
        <ans:codigoPrestadorNaOperadora>${escapeXml(lote.codigoPrestador)}</ans:codigoPrestadorNaOperadora>
      </ans:codigoPrestadorNaOperadora>
    </ans:origem>
    <ans:destino>
      <ans:registroANS>${escapeXml(lote.registroAns)}</ans:registroANS>
    </ans:destino>
    <ans:versaoPadrao>3.05.00</ans:versaoPadrao>
  </ans:cabecalho>
  <ans:prestadorParaOperadora>
    <ans:loteGuias>
      <ans:numeroLote>${escapeXml(lote.numeroLote)}</ans:numeroLote>
      <ans:guiasTISS>
        ${guiasXml.trim()}
      </ans:guiasTISS>
      <ans:valorTotalLote>${valorTotalLote}</ans:valorTotalLote>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>
  <ans:epilogo>
    <ans:hash>${Math.random().toString(36).substring(2, 15)}</ans:hash>
  </ans:epilogo>
</ans:mensagemTISS>`;
}
