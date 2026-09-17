import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { LetterheadHeader, LetterheadFooter } from "@/lib/letterhead-pdf";
import type { ClinicIdentity } from "@/lib/clinic-identity";

/**
 * Ficha mensal de presença (FASE 6 — check-in em papel + ficha mensal de
 * presença). Alimentada pela RPC `monthly_presence_sheet` (supabase/
 * migrations/20260917170700_checkin_paper_signatures.sql) — ver
 * app/recepcao/pacientes/[id]/ficha-presenca/pdf/route.ts. Mesmo template
 * de timbre/rodapé de lib/signature-receipt-pdf.tsx e lib/receipt-pdf.tsx.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 8, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 12 },
  table: { display: "flex", flexDirection: "column", marginTop: 8 },
  row: { flexDirection: "row", borderBottom: "1 solid #ddd", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottom: "1.5 solid #065264", paddingBottom: 4, marginBottom: 2 },
  headerCell: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: "#065264" },
  cell: { fontSize: 8.5 },
  colDate: { width: "12%" },
  colTime: { width: "8%" },
  colTherapist: { width: "22%" },
  colDiscipline: { width: "18%" },
  colStatus: { width: "12%" },
  colSheet: { width: "10%", textAlign: "center" },
  colGuide: { width: "10%", textAlign: "center" },
  colGuideNumber: { width: "8%" },
  signatureSection: { marginTop: 40 },
  signatureLine: { borderTop: "1 solid #333", width: 260, marginTop: 40, paddingTop: 4, fontSize: 8, color: "#555" },
});

export type PresenceSheetRow = {
  appointmentId: string;
  dateLabel: string;
  timeLabel: string;
  therapistName: string;
  discipline: string;
  statusLabel: string;
  presenceSheetSigned: boolean;
  guideSigned: boolean;
  guideNumber: string | null;
};

export type PresenceSheetProps = {
  clinic: ClinicIdentity;
  patientName: string;
  monthLabel: string;
  rows: PresenceSheetRow[];
};

export function PresenceSheetDocument({ clinic, patientName, monthLabel, rows }: PresenceSheetProps) {
  return (
    <Document title={`Ficha de presença — ${patientName} — ${monthLabel}`}>
      <Page size="A4" style={styles.page}>
        <LetterheadHeader clinic={clinic} />
        <Text style={styles.title}>Ficha mensal de presença</Text>
        <Text style={styles.subtitle}>
          {patientName} · {monthLabel}
        </Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.colDate]}>Data</Text>
            <Text style={[styles.headerCell, styles.colTime]}>Hora</Text>
            <Text style={[styles.headerCell, styles.colTherapist]}>Terapeuta</Text>
            <Text style={[styles.headerCell, styles.colDiscipline]}>Especialidade</Text>
            <Text style={[styles.headerCell, styles.colStatus]}>Status</Text>
            <Text style={[styles.headerCell, styles.colSheet]}>Ficha</Text>
            <Text style={[styles.headerCell, styles.colGuide]}>Guia</Text>
            <Text style={[styles.headerCell, styles.colGuideNumber]}>Nº guia</Text>
          </View>

          {rows.map((row) => (
            <View key={row.appointmentId} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.colDate]}>{row.dateLabel}</Text>
              <Text style={[styles.cell, styles.colTime]}>{row.timeLabel}</Text>
              <Text style={[styles.cell, styles.colTherapist]}>{row.therapistName}</Text>
              <Text style={[styles.cell, styles.colDiscipline]}>{row.discipline}</Text>
              <Text style={[styles.cell, styles.colStatus]}>{row.statusLabel}</Text>
              <Text style={[styles.cell, styles.colSheet]}>{row.presenceSheetSigned ? "Sim" : "Não"}</Text>
              <Text style={[styles.cell, styles.colGuide]}>{row.guideSigned ? "Sim" : "Não"}</Text>
              <Text style={[styles.cell, styles.colGuideNumber]}>{row.guideNumber ?? "—"}</Text>
            </View>
          ))}

          {rows.length === 0 && <Text style={{ marginTop: 8, fontSize: 9, color: "#777" }}>Nenhuma sessão no período.</Text>}
        </View>

        <View style={styles.signatureSection}>
          <Text style={styles.signatureLine}>Assinatura do responsável</Text>
        </View>

        <LetterheadFooter clinic={clinic} />
      </Page>
    </Document>
  );
}
