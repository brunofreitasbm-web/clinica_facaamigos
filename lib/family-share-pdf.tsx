import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/**
 * PDF consolidado que a Supervisão compartilha com a família a partir do
 * Prontuário Unificado (app/supervisao/prontuario-unificado). Só recebe
 * itens já considerados seguros para a família hoje — documentos anexados,
 * metas do PTS (ativa/atingida) e decisões de reunião.
 *
 * Salvaguarda de §9.4-A (mesma regra de lib/insurer-report-pdf.tsx): NUNCA
 * receber dados de `session_notes` (evoluções clínicas) nem
 * `protocol_assessments`/`protocol_items` — texto clínico bruto e item
 * licenciado não podem sair em nenhum export pra família. Por isso este
 * arquivo não faz nenhuma query própria, só recebe os campos já resolvidos e
 * filtrados pela action chamadora (generateFamilyShare).
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 20, borderBottom: "2 solid #1a1a1a", paddingBottom: 10 },
  clinicName: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  title: { fontSize: 12, fontWeight: 700, marginTop: 8 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: 700, width: 130 },
  value: { flex: 1 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" },
  itemRow: { marginBottom: 8, paddingBottom: 8, borderBottom: "1 solid #ddd" },
  itemTitle: { fontWeight: 700 },
  itemMeta: { color: "#555", marginTop: 2 },
  empty: { color: "#777", fontStyle: "italic" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#777", borderTop: "1 solid #ddd", paddingTop: 8 },
});

const GOAL_STATUS_LABEL: Record<string, string> = {
  ativa: "Em andamento",
  atingida: "Atingida",
};

export type FamilyShareDocumentItem = {
  category: string;
  categoryLabel: string;
  uploadedAt: string;
  note: string | null;
};

export type FamilyShareGoalItem = {
  description: string;
  domain: string;
  status: string;
};

export type FamilyShareMeetingItem = {
  kindLabel: string;
  heldAt: string;
  decisions: string | null;
};

export type FamilyShareReportProps = {
  clinicName: string;
  patientName: string;
  generatedByName: string;
  generatedAt: string;
  documents: FamilyShareDocumentItem[];
  goals: FamilyShareGoalItem[];
  meetings: FamilyShareMeetingItem[];
};

export function FamilyShareDocument(props: FamilyShareReportProps) {
  const { clinicName, patientName, generatedByName, generatedAt, documents, goals, meetings } = props;

  return (
    <Document title={`Compartilhamento com a família — ${patientName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.clinicName}>{clinicName}</Text>
          <Text style={styles.title}>Resumo do Acompanhamento — Compartilhado com a Família</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Paciente</Text>
          <Text style={styles.value}>{patientName}</Text>
        </View>

        {documents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documentos</Text>
            {documents.map((d, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemTitle}>{d.categoryLabel}</Text>
                <Text style={styles.itemMeta}>
                  Anexado em {d.uploadedAt}
                  {d.note ? ` · ${d.note}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {goals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Metas do plano terapêutico</Text>
            {goals.map((g, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemTitle}>{g.description}</Text>
                <Text style={styles.itemMeta}>
                  Domínio: {g.domain} · Status: {GOAL_STATUS_LABEL[g.status] ?? g.status}
                </Text>
              </View>
            ))}
          </View>
        )}

        {meetings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reuniões</Text>
            {meetings.map((m, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemTitle}>
                  {m.kindLabel} — {m.heldAt}
                </Text>
                <Text style={styles.itemMeta}>{m.decisions ?? "Sem decisões registradas."}</Text>
              </View>
            ))}
          </View>
        )}

        {documents.length === 0 && goals.length === 0 && meetings.length === 0 && (
          <View style={styles.section}>
            <Text style={styles.empty}>Nenhum item selecionado para este compartilhamento.</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text>
            Gerado por {generatedByName} em {generatedAt}. Documento de compartilhamento com a família, via
            Prontuário Unificado.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
