import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { LetterheadHeader, LetterheadFooter } from "@/lib/letterhead-pdf";
import type { ClinicIdentity } from "@/lib/clinic-identity";

/**
 * Comprovante de assinatura eletrônica gerado após a confirmação do OTP em
 * /assinar/[documentId] (app/assinar/[documentId]/signature-actions.ts). É o
 * "arquivo" que fica na ficha do paciente pós-assinatura — antes disso a
 * assinatura só existia como linha em `document_signatures`, sem nenhum PDF
 * anexado a `documents`.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 8, marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: 700, width: 150 },
  value: { flex: 1 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" },
  seal: { marginTop: 4, padding: 10, border: "1 solid #16a34a", borderRadius: 4 },
  sealTitle: { fontWeight: 700, color: "#15803d", marginBottom: 6 },
  hash: { fontSize: 8, color: "#555", marginTop: 6 },
  content: { marginTop: 16, fontSize: 9, lineHeight: 1.5, whiteSpace: "pre-wrap" },
});

export type SignatureReceiptProps = {
  clinic: ClinicIdentity;
  documentTitle: string;
  categoryLabel: string;
  patientName: string;
  content: string;
  signerName: string;
  signerCpf: string;
  signerPhoneMasked: string;
  signerIp: string;
  signedAtFormatted: string;
  documentHash: string;
  validationCode: string;
};

export function SignatureReceiptDocument(props: SignatureReceiptProps) {
  const {
    clinic,
    documentTitle,
    categoryLabel,
    patientName,
    content,
    signerName,
    signerCpf,
    signerPhoneMasked,
    signerIp,
    signedAtFormatted,
    documentHash,
    validationCode,
  } = props;

  return (
    <Document title={`Assinatura Eletrônica — ${documentTitle}`}>
      <Page size="A4" style={styles.page}>
        <LetterheadHeader clinic={clinic} />
        <Text style={styles.title}>{documentTitle}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Categoria</Text>
          <Text style={styles.value}>{categoryLabel}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Paciente</Text>
          <Text style={styles.value}>{patientName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conteúdo do termo</Text>
          <Text style={styles.content}>{content}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.seal}>
            <Text style={styles.sealTitle}>Selo de Validação Jurídica — Assinatura Eletrônica</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Assinado por</Text>
              <Text style={styles.value}>{signerName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>CPF</Text>
              <Text style={styles.value}>{signerCpf}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Telefone confirmado</Text>
              <Text style={styles.value}>{signerPhoneMasked}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Endereço IP</Text>
              <Text style={styles.value}>{signerIp}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Data e hora</Text>
              <Text style={styles.value}>{signedAtFormatted}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Autenticação</Text>
              <Text style={styles.value}>Código OTP via SMS/WhatsApp ({validationCode})</Text>
            </View>
            <Text style={styles.hash}>Hash SHA-256 da assinatura: {documentHash}</Text>
          </View>
        </View>

        <LetterheadFooter clinic={clinic} />
      </Page>
    </Document>
  );
}
