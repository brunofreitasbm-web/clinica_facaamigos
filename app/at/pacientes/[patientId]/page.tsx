import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { AtPatientPanel, type AtPatientData } from "./at-patient-panel";

export const dynamic = "force-dynamic";

export default async function AtPatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("id", patientId)
    .maybeSingle();
  if (!patient) notFound();

  const [
    { data: school },
    { data: meetings },
    { data: sessions },
    { data: modalities },
    { data: reports },
  ] = await Promise.all([
    supabase
      .from("external_contacts")
      .select("id, name, role_title, phone, email, address, grade_level, notes")
      .eq("patient_id", patientId)
      .eq("kind", "escola")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("meetings")
      .select("id, held_at, minutes, decisions")
      .eq("patient_id", patientId)
      .eq("kind", "visita_escolar")
      .order("held_at", { ascending: false }),
    supabase
      .from("at_sessions")
      .select("id, session_date, start_time, end_time, location_kind, evolution, at_modalities(name)")
      .eq("patient_id", patientId)
      .order("session_date", { ascending: false }),
    supabase.from("at_modalities").select("id, name").eq("clinic_id", DEV_CLINIC_ID).eq("active", true).order("name"),
    supabase
      .from("documents")
      .select("id, uploaded_at")
      .eq("patient_id", patientId)
      .eq("category", "relatorio_at_escola")
      .order("uploaded_at", { ascending: false }),
  ]);

  let orientations: { id: string; contactedAt: string; summary: string }[] = [];
  if (school?.id) {
    const { data } = await supabase
      .from("external_contact_logs")
      .select("id, contacted_at, summary")
      .eq("external_contact_id", school.id)
      .eq("channel", "orientacao_professor")
      .order("contacted_at", { ascending: false });
    orientations = (data ?? []).map((o) => ({ id: o.id, contactedAt: o.contacted_at, summary: o.summary }));
  }

  const data: AtPatientData = {
    patientId: patient.id,
    patientName: patient.full_name,
    school: school
      ? {
          id: school.id,
          name: school.name,
          roleTitle: school.role_title,
          phone: school.phone,
          email: school.email,
          address: school.address,
          gradeLevel: school.grade_level,
          notes: school.notes,
        }
      : null,
    meetings: (meetings ?? []).map((m) => ({
      id: m.id,
      heldAtLabel: new Date(m.held_at).toLocaleString("pt-BR"),
      minutes: m.minutes,
      decisions: m.decisions,
    })),
    sessions: (sessions ?? []).map((s) => {
      const modality = Array.isArray(s.at_modalities) ? s.at_modalities[0] : s.at_modalities;
      return {
        id: s.id,
        dateLabel: new Date(`${s.session_date}T00:00:00`).toLocaleDateString("pt-BR"),
        startTime: s.start_time.slice(0, 5),
        endTime: s.end_time.slice(0, 5),
        locationKind: s.location_kind,
        modalityName: modality?.name ?? "—",
        evolution: s.evolution,
      };
    }),
    modalities: modalities ?? [],
    orientations,
    reports: (reports ?? []).map((r) => ({
      id: r.id,
      uploadedAtLabel: new Date(r.uploaded_at).toLocaleString("pt-BR"),
    })),
  };

  return <AtPatientPanel data={data} />;
}
