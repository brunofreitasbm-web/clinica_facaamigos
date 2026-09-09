import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { LetterheadHeader, LetterheadFooter } from "@/lib/letterhead-pdf";
import type { ClinicIdentity } from "@/lib/clinic-identity";

/**
 * Relatório de evolução PARA O CONVÊNIO (§8 Fase 2 do PRD) — diferente do
 * relatório devolutivo por IA (`draft_reports`, linguagem de pais, mural da
 * família). Este é o documento técnico que justifica renovação de guia.
 *
 * Salvaguarda de §9.4-A: NUNCA importa nada de `protocol_items` ou
 * `protocol_assessments` — só `plan_goals.description` (texto redigido pela
 * própria clínica, não o item licenciado) e frequência/dados agregados.
 * Se um dia isso precisar mostrar pontuação de protocolo, adicionar só
 * número/gráfico, nunca o texto do item (a regra vale pro código, não só
 * pro dado — por isso este arquivo não faz nenhuma query própria, só recebe
 * os campos já resolvidos pela action chamadora).
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 8, marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: 700, width: 130 },
  value: { flex: 1 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" },
  goalRow: { marginBottom: 8, paddingBottom: 8, borderBottom: "1 solid #ddd" },
  goalTitle: { fontWeight: 700 },
  goalMeta: { color: "#555", marginTop: 2 },
});

const STATUS_LABEL: Record<string, string> = {
  ativa: "Em andamento",
  atingida: "Atingida",
  suspensa: "Suspensa",
};

export type InsurerReportGoal = {
  description: string;
  domain: string;
  criterion: string | null;
  status: string;
};

export type InsurerReportProps = {
  clinic: ClinicIdentity;
  patientName: string;
  birthDate: string;
  cid: string | null;
  periodStart: string;
  periodEnd: string;
  sessionsRealized: number;
  sessionsAbsent: number;
  goals: InsurerReportGoal[];
  generatedByName: string;
  generatedAt: string;
};

export function InsurerReportDocument(props: InsurerReportProps) {
  const {
    clinic,
    patientName,
    birthDate,
    cid,
    periodStart,
    periodEnd,
    sessionsRealized,
    sessionsAbsent,
    goals,
    generatedByName,
    generatedAt,
  } = props;

  return (
    <Document title={`Relatório de evolução — ${patientName}`}>
      <Page size="A4" style={styles.page}>
        <LetterheadHeader clinic={clinic} />
        <Text style={styles.title}>Relatório de Evolução Terapêutica</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Paciente</Text>
          <Text style={styles.value}>{patientName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Data de nascimento</Text>
          <Text style={styles.value}>{birthDate}</Text>
        </View>
        {cid && (
          <View style={styles.row}>
            <Text style={styles.label}>CID</Text>
            <Text style={styles.value}>{cid}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Período do relatório</Text>
          <Text style={styles.value}>
            {periodStart} a {periodEnd}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequência no período</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Sessões realizadas</Text>
            <Text style={styles.value}>{sessionsRealized}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Faltas/cancelamentos</Text>
            <Text style={styles.value}>{sessionsAbsent}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metas do plano terapêutico</Text>
          {goals.length === 0 && <Text>Nenhuma meta ativa registrada no plano aprovado.</Text>}
          {goals.map((g, i) => (
            <View key={i} style={styles.goalRow}>
              <Text style={styles.goalTitle}>{g.description}</Text>
              <Text style={styles.goalMeta}>
                Domínio: {g.domain}
                {g.criterion ? ` · Critério: ${g.criterion}` : ""} · Status:{" "}
                {STATUS_LABEL[g.status] ?? g.status}
              </Text>
            </View>
          ))}
        </View>

        <Text style={{ marginTop: 16, fontSize: 8, color: "#777" }}>
          Gerado por {generatedByName} em {generatedAt}. Documento técnico para fins de
          justificativa de cobertura junto ao convênio.
        </Text>

        <LetterheadFooter clinic={clinic} />
      </Page>
    </Document>
  );
}
