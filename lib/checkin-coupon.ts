// lib/checkin-coupon.ts
//
// Módulo puro do cupom de check-in 80mm/58mm (sem React, sem Supabase) —
// roda tanto no server action que monta o cupom de verdade
// (app/recepcao/agenda/coupon-actions.ts) quanto no client, na prévia da
// tela de configurações (app/gestor/configuracoes/cupom-checkin). Manter
// puro é o que permite testar `buildCouponModel` sem banco (ver
// tests/checkin-coupon.test.ts) e reusar a mesma formatação nos dois lados.

export type CouponTriggerMode = "primeiro" | "todos" | "manual";
export type CouponPaperWidthMm = 58 | 80;

export type CouponSettings = {
  enabled: boolean;
  triggerMode: CouponTriggerMode;
  paperWidthMm: CouponPaperWidthMm;
  headerText: string;
  footerText: string;
  showLogo: boolean;
  showClinicName: boolean;
  showPatientName: boolean;
  showTicketLabel: boolean;
  showCheckinTime: boolean;
  showRoom: boolean;
  showDiscipline: boolean;
  showTherapist: boolean;
  showTimeRange: boolean;
  showWarnings: boolean;
  showPrintedAt: boolean;
};

export const DEFAULT_COUPON_SETTINGS: CouponSettings = {
  enabled: true,
  triggerMode: "primeiro",
  paperWidthMm: 80,
  headerText: "",
  footerText: "",
  showLogo: true,
  showClinicName: true,
  showPatientName: true,
  showTicketLabel: true,
  showCheckinTime: true,
  showRoom: true,
  showDiscipline: true,
  showTherapist: true,
  showTimeRange: true,
  showWarnings: true,
  showPrintedAt: true,
};

/** Formato achatado de uma linha de `checkin_coupon_settings` (snake_case, como vem do Supabase). */
export type CheckinCouponSettingsRow = {
  enabled: boolean;
  trigger_mode: string;
  paper_width_mm: number;
  header_text: string | null;
  footer_text: string | null;
  show_logo: boolean;
  show_clinic_name: boolean;
  show_patient_name: boolean;
  show_ticket_label: boolean;
  show_checkin_time: boolean;
  show_room: boolean;
  show_discipline: boolean;
  show_therapist: boolean;
  show_time_range: boolean;
  show_warnings: boolean;
  show_printed_at: boolean;
};

const TRIGGER_MODES: readonly CouponTriggerMode[] = ["primeiro", "todos", "manual"];
const PAPER_WIDTHS: readonly CouponPaperWidthMm[] = [58, 80];

/**
 * Converte uma linha do banco (ou `null`, quando a clínica ainda não tem
 * linha ou a RLS negou a leitura) para `CouponSettings`, sempre caindo nos
 * defaults em vez de lançar — o cupom nunca deve travar o check-in por
 * causa de uma settings ausente.
 */
export function couponSettingsFromRow(row: CheckinCouponSettingsRow | null | undefined): CouponSettings {
  if (!row) return DEFAULT_COUPON_SETTINGS;
  const triggerMode = TRIGGER_MODES.includes(row.trigger_mode as CouponTriggerMode)
    ? (row.trigger_mode as CouponTriggerMode)
    : DEFAULT_COUPON_SETTINGS.triggerMode;
  const paperWidthMm = PAPER_WIDTHS.includes(row.paper_width_mm as CouponPaperWidthMm)
    ? (row.paper_width_mm as CouponPaperWidthMm)
    : DEFAULT_COUPON_SETTINGS.paperWidthMm;
  return {
    enabled: row.enabled,
    triggerMode,
    paperWidthMm,
    headerText: row.header_text ?? "",
    footerText: row.footer_text ?? "",
    showLogo: row.show_logo,
    showClinicName: row.show_clinic_name,
    showPatientName: row.show_patient_name,
    showTicketLabel: row.show_ticket_label,
    showCheckinTime: row.show_checkin_time,
    showRoom: row.show_room,
    showDiscipline: row.show_discipline,
    showTherapist: row.show_therapist,
    showTimeRange: row.show_time_range,
    showWarnings: row.show_warnings,
    showPrintedAt: row.show_printed_at,
  };
}

export type CouponSessionInput = {
  startsAt: string;
  endsAt: string;
  roomName: string;
  disciplineLabel: string;
  therapistName: string;
  warning?: string;
};

/** Dados crus (já achatados pelo server action) para montar um cupom. */
export type CouponInput = {
  clinicName: string;
  patientName: string;
  /** Data civil (`YYYY-MM-DD`) do dia de atendimento — não necessariamente hoje (reimpressão). */
  serviceDate: string;
  /** ISO do check-in que disparou a impressão (null na prévia/teste). */
  checkinAt: string | null;
  ticketLabel: string | null;
  /** ISO do instante em que o cupom foi montado — vira o rodapé "impresso em". */
  printedAt: string;
  /** URL absoluta da logo (montada no client — `srcdoc` não resolve caminho relativo). */
  logoUrl: string | null;
  sessions: CouponSessionInput[];
};

export type CouponModelLine = {
  timeRange: string | null;
  roomName: string | null;
  disciplineLabel: string | null;
  therapistName: string | null;
};

/** Modelo já formatado e filtrado pelos toggles de `CouponSettings` — o render só concatena. */
export type CouponModel = {
  paperWidthMm: CouponPaperWidthMm;
  logoUrl: string | null;
  headerText: string;
  footerText: string;
  clinicName: string | null;
  patientName: string | null;
  dateLabel: string;
  checkinTimeLabel: string | null;
  ticketLabel: string | null;
  lines: CouponModelLine[];
  warnings: string[];
  printedAtLabel: string | null;
};

const CLINIC_TIMEZONE_FALLBACK = "America/Sao_Paulo";

/**
 * Caminho (relativo a `public/`) da variante de logo usada no cupom —
 * `-sem-assinatura`. É a única exceção à regra de usar a marca completa: em
 * 80mm/203dpi a assinatura "Centro de Terapia Comportamental" fica abaixo do
 * tamanho mínimo do brand/README.md (160px / 45mm) e vira borrão — o próprio
 * manual manda cair para a versão sem assinatura nesse caso. Fica relativo de propósito: um documento aberto num
 * iframe `srcdoc` tem base `about:srcdoc` e não resolve caminho relativo —
 * `lib/print-coupon.ts` (client) converte para URL absoluta antes de
 * imprimir. A prévia em `cupom-manager.tsx`, por estar na própria página,
 * resolve este caminho relativo normalmente.
 */
export const COUPON_LOGO_PATH = "/brand/facaamigos-horizontal-sem-assinatura.svg";

function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/**
 * Monta o modelo do cupom a partir dos dados crus e das settings — única
 * fonte de formatação (horas, ordenação, dedupe de avisos). `timeZone`
 * default é o da clínica; parametrizado só para permitir testar sem
 * depender de `CLINIC_TIMEZONE`.
 */
export function buildCouponModel(
  input: CouponInput,
  settings: CouponSettings,
  timeZone: string = CLINIC_TIMEZONE_FALLBACK,
): CouponModel {
  const sortedSessions = [...input.sessions].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  const lines: CouponModelLine[] = sortedSessions.map((s) => ({
    timeRange: settings.showTimeRange ? `${formatTime(s.startsAt, timeZone)}–${formatTime(s.endsAt, timeZone)}` : null,
    roomName: settings.showRoom ? s.roomName : null,
    disciplineLabel: settings.showDiscipline ? s.disciplineLabel : null,
    therapistName: settings.showTherapist ? s.therapistName : null,
  }));

  const warnings = settings.showWarnings
    ? Array.from(new Set(sortedSessions.map((s) => s.warning).filter((w): w is string => Boolean(w))))
    : [];

  return {
    paperWidthMm: settings.paperWidthMm,
    logoUrl: settings.showLogo ? input.logoUrl : null,
    headerText: settings.headerText,
    footerText: settings.footerText,
    clinicName: settings.showClinicName ? input.clinicName : null,
    patientName: settings.showPatientName ? input.patientName : null,
    dateLabel: formatDateLabel(input.serviceDate),
    checkinTimeLabel: settings.showCheckinTime && input.checkinAt ? formatTime(input.checkinAt, timeZone) : null,
    ticketLabel: settings.showTicketLabel ? input.ticketLabel : null,
    lines,
    warnings,
    printedAtLabel: settings.showPrintedAt
      ? new Date(input.printedAt).toLocaleString("pt-BR", { timeZone })
      : null,
  };
}

/** Paciente/sessões fictícios para a prévia e o "Imprimir teste" da tela de configurações. */
export const SAMPLE_COUPON_INPUT: CouponInput = {
  clinicName: "FaçaAmigos",
  patientName: "Paciente Exemplo",
  serviceDate: "2026-09-09",
  checkinAt: "2026-09-09T13:32:00.000Z",
  ticketLabel: "Q012",
  printedAt: "2026-09-09T13:32:05.000Z",
  logoUrl: null,
  sessions: [
    {
      startsAt: "2026-09-09T13:30:00.000Z",
      endsAt: "2026-09-09T14:15:00.000Z",
      roomName: "Sala 2",
      disciplineLabel: "Psicologia ABA",
      therapistName: "Ana Beatriz",
    },
    {
      startsAt: "2026-09-09T14:30:00.000Z",
      endsAt: "2026-09-09T15:15:00.000Z",
      roomName: "Sala 4",
      disciplineLabel: "Fonoaudiologia",
      therapistName: "Carlos Eduardo",
      warning: "Sessão sem guia de convênio vinculada.",
    },
  ],
};
