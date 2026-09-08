import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { CLINIC_TIMEZONE } from "@/lib/constants";

/**
 * Timeline unificada do prontuário de um paciente — mesmas 4 fontes que
 * app/supervisao/prontuario-unificado/page.tsx usa (session_notes,
 * protocol_assessments, meetings, documents). Extraída pra
 * app/terapeuta/prontuario reusar sem duplicar as ~90 linhas de query e
 * mapeamento; a RLS de cada tabela é quem decide o que cada papel enxerga
 * (terapeuta só vê o que tem patient_access/therapist_id, protocolos só os
 * que é certificado — ver 20260907170000 e 20260904000004).
 *
 * Não inclui `record_access_log`: esse continua exclusivo da tela de
 * supervisão (gestor/supervisor only via RLS); o terapeuta usa a RPC
 * patient_record_access_trail (20260908190000) em vez disso.
 */
export type TimelineItem = {
  id: string;
  date: string;
  type: string;
  author: string;
  summary: string;
  detail: string;
  /** Só presente em itens de evolução (id começa com "note-") — appointment_id pra linkar /terapeuta/evolucao/{id}. */
  appointmentId?: string;
};

export type PatientTimelineResult = {
  timeline: TimelineItem[];
  signedNotesCount: number;
  totalNotesCount: number;
  versionedNotesCount: number;
};

export function fmt(dateIso: string): string {
  return new Date(dateIso).toLocaleString("pt-BR", {
    timeZone: CLINIC_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function truncate(text: string | null | undefined, max = 220): string {
  if (!text) return "Sem resumo registrado.";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function getPatientTimeline(
  supabase: SupabaseClient<Database>,
  patientId: string,
  opts: { limit?: number } = {},
): Promise<PatientTimelineResult> {
  const limit = opts.limit ?? 30;

  const [notesRes, assessmentsRes, meetingsRes, documentsRes] = await Promise.all([
    supabase
      .from("session_notes")
      .select(
        "id, appointment_id, version, free_text, signed_at, created_at_server, appointments!inner(patient_id, starts_at), profiles!session_notes_therapist_id_fkey(full_name)",
      )
      .eq("appointments.patient_id", patientId)
      .order("created_at_server", { ascending: false })
      .limit(20),
    supabase
      .from("protocol_assessments")
      .select("id, assessed_at, scores, protocols(name), profiles!assessed_by(full_name)")
      .eq("patient_id", patientId)
      .order("assessed_at", { ascending: false })
      .limit(10),
    supabase
      .from("meetings")
      .select("id, held_at, kind, decisions, minutes, profiles!conducted_by(full_name)")
      .eq("patient_id", patientId)
      .order("held_at", { ascending: false })
      .limit(10),
    supabase
      .from("documents")
      .select("id, uploaded_at, category, note, profiles!uploaded_by(full_name)")
      .eq("patient_id", patientId)
      .order("uploaded_at", { ascending: false })
      .limit(10),
  ]);

  const notes = notesRes.data ?? [];
  const totalNotesCount = notes.length;
  const signedNotesCount = notes.filter((n) => n.signed_at).length;
  const versionedNotesCount = notes.filter((n) => n.version > 1).length;

  const noteItems: TimelineItem[] = notes.map((n) => {
    const therapist = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles;
    return {
      id: `note-${n.id}`,
      date: n.created_at_server,
      type: `Evolução Clínica (v${n.version})`,
      author: therapist?.full_name ?? "Terapeuta",
      summary: truncate(n.free_text),
      detail: n.signed_at ? `Assinada em ${fmt(n.signed_at)}` : "Ainda não assinada",
      appointmentId: n.appointment_id,
    };
  });

  const assessmentItems: TimelineItem[] = (assessmentsRes.data ?? []).map((a: any) => {
    const protocol = Array.isArray(a.protocols) ? a.protocols[0] : a.protocols;
    const evaluator = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
    return {
      id: `assessment-${a.id}`,
      date: a.assessed_at,
      type: `Avaliação de Protocolo — ${protocol?.name ?? "Protocolo"}`,
      author: evaluator?.full_name ?? "Avaliador",
      summary: "Aplicação registrada com pontuações no protocolo.",
      detail: "Ver detalhes na ficha de avaliação do paciente",
    };
  });

  const meetingItems: TimelineItem[] = (meetingsRes.data ?? []).map((m: any) => {
    const conductor = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: `meeting-${m.id}`,
      date: m.held_at,
      type:
        m.kind === "revisao_pts"
          ? "Reunião — Revisão de PTS"
          : m.kind === "devolutiva"
            ? "Reunião — Devolutiva"
            : `Reunião — ${m.kind}`,
      author: conductor?.full_name ?? "Coordenação Clínica",
      summary: truncate(m.decisions ?? m.minutes),
      detail: "Registro de reunião",
    };
  });

  const documentItems: TimelineItem[] = (documentsRes.data ?? []).map((d: any) => {
    const uploader = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
    return {
      id: `doc-${d.id}`,
      date: d.uploaded_at,
      type: `Documento — ${d.category}`,
      author: uploader?.full_name ?? "—",
      summary:
        truncate(d.note, 160) === "Sem resumo registrado." ? "Documento anexado ao prontuário." : truncate(d.note, 160),
      detail: "Documento",
    };
  });

  const timeline = [...noteItems, ...assessmentItems, ...meetingItems, ...documentItems]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  return { timeline, signedNotesCount, totalNotesCount, versionedNotesCount };
}
