import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { civilTimeInTimeZone, monthRangeInTimeZone, todayInTimeZone } from "@/lib/timezone";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/appointment-status-style";

/**
 * Baixa a ficha mensal de presença em PDF (FASE 6). Mesmo padrão de
 * `lib/receipts.ts` (import isolado de módulos com TSX/alias via `await
 * import(...)`, pra não arrastar esse grafo pra dentro do runner de testes
 * puro) e do RPC `monthly_presence_sheet` já usado pela página server-side
 * irmã (../page.tsx).
 */

type PresenceSheetRpcRow = {
  appointment_id: string;
  starts_at: string;
  therapist_name: string;
  discipline: string;
  status: string;
  presence_sheet_signed_at: string | null;
  guide_signed_at: string | null;
  guide_number: string | null;
};

function isValidMonth(month: string | null): month is string {
  return Boolean(month && /^\d{4}-\d{2}$/.test(month));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const monthParam = request.nextUrl.searchParams.get("month");
  const month = isValidMonth(monthParam) ? monthParam : todayInTimeZone(CLINIC_TIMEZONE).slice(0, 7);

  const supabase = await createClient();

  const { data: patient } = await supabase.from("patients").select("id, full_name, clinic_id").eq("id", id).maybeSingle();
  if (!patient) {
    return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
  }

  const { startIso, endIso } = monthRangeInTimeZone(month, CLINIC_TIMEZONE);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rowsRaw, error } = await (supabase as any).rpc("monthly_presence_sheet", {
    p_patient_id: id,
    p_month_start: startIso,
    p_month_end: endIso,
  });

  if (error) {
    return NextResponse.json({ error: "Não foi possível carregar a ficha de presença." }, { status: 500 });
  }

  const rows: PresenceSheetRpcRow[] = rowsRaw ?? [];

  const { getClinicIdentity } = await import("@/lib/clinic-identity");
  const { PresenceSheetDocument } = await import("@/lib/presence-sheet-pdf");

  const clinic = await getClinicIdentity(supabase, patient.clinic_id);
  const [year, monthNum] = month.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const pdfBuffer = await renderToBuffer(
    PresenceSheetDocument({
      clinic,
      patientName: patient.full_name,
      monthLabel,
      rows: rows.map((row) => ({
        appointmentId: row.appointment_id,
        dateLabel: new Date(row.starts_at).toLocaleDateString("pt-BR", { timeZone: CLINIC_TIMEZONE }),
        timeLabel: civilTimeInTimeZone(row.starts_at, CLINIC_TIMEZONE),
        therapistName: row.therapist_name,
        discipline: row.discipline,
        statusLabel: APPOINTMENT_STATUS_STYLE[row.status]?.label ?? row.status,
        presenceSheetSigned: Boolean(row.presence_sheet_signed_at),
        guideSigned: Boolean(row.guide_signed_at),
        guideNumber: row.guide_number,
      })),
    }),
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="ficha-presenca-${month}.pdf"`,
    },
  });
}
