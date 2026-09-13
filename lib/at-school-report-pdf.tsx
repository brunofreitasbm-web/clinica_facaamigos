import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { LetterheadHeader, LetterheadFooter } from "@/lib/letterhead-pdf";
import type { ClinicIdentity } from "@/lib/clinic-identity";

/**
 * Relatório de Acompanhamento Terapêutico (AT) PARA A ESCOLA — documento
 * padronizado e timbrado, mesmo padrão de lib/insurer-report-pdf.tsx: usa o
 * timbre compartilhado (LetterheadHeader/Footer) e não faz nenhuma query
 * própria, só recebe os campos já resolvidos pela action chamadora
 * (app/at/pacientes/[patientId]/at-actions.ts:generateSchoolReport).
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 8, marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: 700, width: 130 },
  value: { flex: 1 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" },
  entryRow: { marginBottom: 8, paddingBottom: 8, borderBottom: "1 solid #ddd" },
  entryTitle: { fontWeight: 700 },
  entryMeta: { color: "#555", marginTop: 2 },
  signature: { marginTop: 32, borderTop: "1 solid #999", paddingTop: 6, width: 260 },
});

const LOCATION_LABEL: Record<string, string> = {
  escola: "Escola",
  domicilio: "Domicílio",
  comunidade: "Comunidade",
  outro: "Outro",
};

export type AtSchoolReportSession = {
  date: string;
  startTime: string;
  endTime: string;
  locationKind: string;
  modalityName: string;
  evolution: string;
};

export type AtSchoolReportOrientation = {
  date: string;
  summary: string;
};

export type AtSchoolReportProps = {
  clinic: ClinicIdentity;
  patientName: string;
  birthDate: string;
  schoolName: string;
  schoolRoleTitle: string | null;
  periodStart: string;
  periodEnd: string;
  sessions: AtSchoolReportSession[];
  orientations: AtSchoolReportOrientation[];
  professionalName: string;
  professionalCouncil: string;
  generatedAt: string;
};

export function AtSchoolReportDocument(props: AtSchoolReportProps) {
  const {
    clinic,
    patientName,
    birthDate,
    schoolName,
    schoolRoleTitle,
    periodStart,
    periodEnd,
    sessions,
    orientations,
    professionalName,
    professionalCouncil,
    generatedAt,
  } = props;

  return (
    <Document title={`Relatório de AT — ${patientName}`}>
      <Page size="A4" style={styles.page}>
        <LetterheadHeader clinic={clinic} />
        <Text style={styles.title}>Relatório de Acompanhamento Terapêutico (AT)</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Paciente</Text>
          <Text style={styles.value}>{patientName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Data de nascimento</Text>
          <Text style={styles.value}>{birthDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Escola</Text>
          <Text style={styles.value}>
            {schoolName}
            {schoolRoleTitle ? ` (${schoolRoleTitle})` : ""}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Período do relatório</Text>
          <Text style={styles.value}>
            {periodStart} a {periodEnd}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sessões de AT no período</Text>
          {sessions.length === 0 && <Text>Nenhuma sessão de AT registrada neste período.</Text>}
          {sessions.map((s, i) => (
            <View key={i} style={styles.entryRow}>
              <Text style={styles.entryTitle}>
                {s.date} · {s.startTime}–{s.endTime} · {LOCATION_LABEL[s.locationKind] ?? s.locationKind} ·{" "}
                {s.modalityName}
              </Text>
              <Text style={styles.entryMeta}>{s.evolution}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Orientações aos professores no período</Text>
          {orientations.length === 0 && <Text>Nenhuma orientação registrada neste período.</Text>}
          {orientations.map((o, i) => (
            <View key={i} style={styles.entryRow}>
              <Text style={styles.entryTitle}>{o.date}</Text>
              <Text style={styles.entryMeta}>{o.summary}</Text>
            </View>
          ))}
        </View>

        <View style={styles.signature}>
          <Text>{professionalName}</Text>
          {professionalCouncil && <Text>{professionalCouncil}</Text>}
        </View>

        <Text style={{ marginTop: 16, fontSize: 8, color: "#777" }}>
          Gerado por {professionalName} em {generatedAt}. Documento de acompanhamento terapêutico
          compartilhado com a instituição de ensino para fins de orientação escolar.
        </Text>

        <LetterheadFooter clinic={clinic} />
      </Page>
    </Document>
  );
}
