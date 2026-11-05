// lib/session-audit-pure.ts
import { CANCEL_REASONS } from "./appointment-cancel-reasons.ts";

export const SESSION_AUDIT_STATUS_LABEL: Record<string, string> = {
  cancelada_familia: "Cancelada pela família",
  cancelada_terapeuta: "Cancelada pelo terapeuta",
  cancelada_clinica: "Cancelada pela clínica",
  remarcada: "Remarcada",
};

export type SessionAuditSource = {
  id: string;
  starts_at: string;
  status: string;
  cancel_reason: string | null;
  cancelled_at: string | null;
  patient: { full_name: string | null } | { full_name: string | null }[] | null;
  therapist: { full_name: string | null } | { full_name: string | null }[] | null;
  canceller: { full_name: string | null } | { full_name: string | null }[] | null;
};

export type SessionAuditRow = {
  id: string;
  startsAt: string;
  statusLabel: string;
  reasonLabel: string;
  patientName: string;
  therapistName: string;
  cancelledBy: string;
  cancelledAt: string | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export function reasonLabel(reason: string | null): string {
  if (!reason) return "Sem motivo registrado";
  return CANCEL_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

export function toSessionAuditRow(r: SessionAuditSource): SessionAuditRow {
  return {
    id: r.id,
    startsAt: r.starts_at,
    statusLabel: SESSION_AUDIT_STATUS_LABEL[r.status] ?? r.status,
    reasonLabel: reasonLabel(r.cancel_reason),
    patientName: one(r.patient)?.full_name ?? "—",
    therapistName: one(r.therapist)?.full_name ?? "—",
    cancelledBy: one(r.canceller)?.full_name ?? "Não registrado",
    cancelledAt: r.cancelled_at,
  };
}
