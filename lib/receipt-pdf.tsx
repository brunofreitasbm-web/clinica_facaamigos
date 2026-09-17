import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { LetterheadHeader, LetterheadFooter } from "@/lib/letterhead-pdf";
import type { ClinicIdentity } from "@/lib/clinic-identity";

/**
 * Recibo de pagamento (FASE 2 — Contratos pacote/avulsa + recibos). Gerado
 * toda vez que uma fatura de contrato (`contract_invoices`) ou uma cobrança
 * avulsa (`patient_charges`) é marcada como paga — ver lib/receipts.ts. Estilo
 * espelha lib/signature-receipt-pdf.tsx (mesmo timbre, mesmas primitivas de
 * layout), trocando o selo de assinatura por um selo de quitação.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 14, fontWeight: 700, marginTop: 8, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 16 },
  row: { flexDirection: "row", marginBottom: 6 },
  label: { fontWeight: 700, width: 150 },
  value: { flex: 1 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" },
  amountBox: {
    marginTop: 16,
    padding: 14,
    border: "1 solid #065264",
    borderRadius: 4,
    alignItems: "center",
  },
  amountLabel: { fontSize: 9, color: "#555", marginBottom: 4, textTransform: "uppercase" },
  amountValue: { fontSize: 22, fontWeight: 700, color: "#065264" },
  seal: { marginTop: 24, padding: 10, border: "1 solid #16a34a", borderRadius: 4 },
  sealTitle: { fontWeight: 700, color: "#15803d", marginBottom: 6 },
  hash: { fontSize: 8, color: "#555", marginTop: 6 },
});

export type ReceiptProps = {
  clinicName: string;
  clinicCnpj: string | null;
  number: number;
  year: number;
  payerName: string;
  payerDocument?: string | null;
  patientName: string;
  description: string;
  amount: number;
  paidAtFormatted: string;
  method?: string | null;
};

const METHOD_LABEL: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  transferencia: "Transferência bancária",
};

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatReceiptNumberLabel(year: number, number: number): string {
  return `${year}/${String(number).padStart(4, "0")}`;
}

export function ReceiptDocument(props: ReceiptProps) {
  const {
    clinicName,
    clinicCnpj,
    number,
    year,
    payerName,
    payerDocument,
    patientName,
    description,
    amount,
    paidAtFormatted,
    method,
  } = props;

  // Só os dados mínimos necessários para o timbre — quem chama
  // (lib/receipts.ts) tem a ClinicIdentity completa disponível via
  // getClinicIdentity, mas o contrato desta função pede só nome/CNPJ.
  const clinic: ClinicIdentity = {
    nomeFantasia: clinicName,
    razaoSocial: null,
    cnpj: clinicCnpj,
    endereco: null,
    cidade: null,
    telefone: null,
    whatsapp: null,
    email: null,
    site: null,
    responsavel: null,
  };

  const receiptNumberLabel = formatReceiptNumberLabel(year, number);
  const methodLabel = method ? (METHOD_LABEL[method] ?? method) : null;

  return (
    <Document title={`Recibo ${receiptNumberLabel}`}>
      <Page size="A4" style={styles.page}>
        <LetterheadHeader clinic={clinic} />
        <Text style={styles.title}>Recibo de Pagamento</Text>
        <Text style={styles.subtitle}>Recibo nº {receiptNumberLabel}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Recebemos de</Text>
          <Text style={styles.value}>{payerName}</Text>
        </View>
        {payerDocument && (
          <View style={styles.row}>
            <Text style={styles.label}>CPF/CNPJ</Text>
            <Text style={styles.value}>{payerDocument}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Referente ao paciente</Text>
          <Text style={styles.value}>{patientName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Descrição</Text>
          <Text style={styles.value}>{description}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Data do pagamento</Text>
          <Text style={styles.value}>{paidAtFormatted}</Text>
        </View>
        {methodLabel && (
          <View style={styles.row}>
            <Text style={styles.label}>Forma de pagamento</Text>
            <Text style={styles.value}>{methodLabel}</Text>
          </View>
        )}

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Valor pago</Text>
          <Text style={styles.amountValue}>{formatCurrency(amount)}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.seal}>
            <Text style={styles.sealTitle}>Selo de Quitação</Text>
            <Text>
              Este recibo comprova a quitação integral do valor descrito acima, referente aos serviços
              prestados por {clinicName}. Documento gerado automaticamente pelo sistema no ato da confirmação
              de pagamento — guarde-o para eventual solicitação de reembolso junto ao plano de saúde.
            </Text>
            <Text style={styles.hash}>Recibo {receiptNumberLabel} · emitido em {paidAtFormatted}</Text>
          </View>
        </View>

        <LetterheadFooter clinic={clinic} />
      </Page>
    </Document>
  );
}
