import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supa = SupabaseClient<Database>;

export type TherapistPatientItem = {
  id: string;
  full_name: string;
  status: string;
};

/**
 * Retorna todos os pacientes que o terapeuta tem permissão de acessar no Prontuário Unificado.
 *
 * Um terapeuta possui acesso ao prontuário se:
 * 1. Possui vínculo em `patient_access` (access_type = 'terapeuta' e revoked_at nulo);
 * 2. Está escalado ou possui qualquer agendamento em `appointments` (`therapist_id = therapistId`);
 * 3. Já realizou ou registrou qualquer evolução em `session_notes` (`therapist_id` ou `author_id`).
 */
export async function getTherapistPatients(
  supabase: Supa,
  therapistId: string,
): Promise<TherapistPatientItem[]> {
  const [accessRes, apptsRes, notesRes] = await Promise.all([
    supabase
      .from("patient_access")
      .select("patient_id, patients(id, full_name, status)")
      .eq("profile_id", therapistId)
      .eq("access_type", "terapeuta")
      .is("revoked_at", null),

    supabase
      .from("appointments")
      .select("patient_id, patients(id, full_name, status)")
      .eq("therapist_id", therapistId),

    supabase
      .from("session_notes")
      .select("appointments!inner(patient_id, patients(id, full_name, status))")
      .or(`therapist_id.eq.${therapistId},author_id.eq.${therapistId}`),
  ]);

  const patientMap = new Map<string, TherapistPatientItem>();

  // 1. patient_access
  if (accessRes.data) {
    for (const item of accessRes.data) {
      const p = Array.isArray(item.patients) ? item.patients[0] : item.patients;
      if (p && p.id) {
        patientMap.set(p.id, { id: p.id, full_name: p.full_name, status: p.status });
      }
    }
  }

  // 2. appointments
  if (apptsRes.data) {
    for (const item of apptsRes.data) {
      const p = Array.isArray(item.patients) ? item.patients[0] : item.patients;
      if (p && p.id) {
        patientMap.set(p.id, { id: p.id, full_name: p.full_name, status: p.status });
      }
    }
  }

  // 3. session_notes
  if (notesRes.data) {
    for (const item of notesRes.data) {
      const appt = Array.isArray(item.appointments) ? item.appointments[0] : item.appointments;
      if (appt) {
        const p = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients;
        if (p && p.id) {
          patientMap.set(p.id, { id: p.id, full_name: p.full_name, status: p.status });
        }
      }
    }
  }

  return Array.from(patientMap.values()).sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );
}
