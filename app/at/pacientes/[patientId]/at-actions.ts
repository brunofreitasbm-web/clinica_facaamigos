"use server";

import { randomUUID } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClinicIdentity } from "@/lib/clinic-identity";
import { AtSchoolReportDocument, type AtSchoolReportSession } from "@/lib/at-school-report-pdf";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Cadastro de escola na rede externa (external_contacts, kind='escola') —
 * reaproveitado, não duplicado (ver
 * supabase/migrations/20260908080002_external_network.sql). Um paciente tem
 * no máximo uma escola ativa cadastrada por este fluxo: chamando de novo com
 * `contactId` edita a existente em vez de criar outra.
 */
export async function upsertSchoolContact(
  patientId: string,
  contactId: string | null,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const roleTitle = String(formData.get("role_title") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const gradeLevel = String(formData.get("grade_level") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) return { success: false, error: "Informe o nome da escola." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const payload = { name, role_title: roleTitle, phone, email, address, grade_level: gradeLevel, notes };

  let error;
  if (contactId) {
    ({ error } = await supabase.from("external_contacts").update(payload).eq("id", contactId));
  } else {
    const { data: patient } = await supabase.from("patients").select("clinic_id").eq("id", patientId).maybeSingle();
    if (!patient) return { success: false, error: "Paciente não encontrado." };
    ({ error } = await supabase.from("external_contacts").insert({
      ...payload,
      clinic_id: patient.clinic_id,
      patient_id: patientId,
      kind: "escola",
      created_by: user.id,
    }));
  }

  if (error) return { success: false, error: "Não foi possível salvar o cadastro da escola." };

  revalidatePath(`/at/pacientes/${patientId}`);
  return { success: true };
}

/** Reunião de visita escolar — meetings(kind='visita_escolar'), ligada à escola cadastrada. */
export async function createSchoolMeeting(
  patientId: string,
  schoolContactId: string,
  formData: FormData,
): Promise<ActionResult> {
  const heldAtDate = String(formData.get("held_at_date") ?? "");
  const heldAtTime = String(formData.get("held_at_time") ?? "") || "12:00";
  const minutes = String(formData.get("minutes") ?? "").trim();
  const decisions = String(formData.get("decisions") ?? "").trim();

  if (!heldAtDate) return { success: false, error: "Informe a data da reunião." };
  if (!minutes) return { success: false, error: "Registre ao menos um resumo da reunião (ata)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase.from("meetings").insert({
    patient_id: patientId,
    kind: "visita_escolar",
    external_contact_id: schoolContactId,
    held_at: new Date(`${heldAtDate}T${heldAtTime}:00`).toISOString(),
    conducted_by: user.id,
    minutes,
    decisions: decisions || null,
  });

  if (error) return { success: false, error: "Não foi possível registrar a reunião. Verifique sua permissão para este paciente." };

  revalidatePath(`/at/pacientes/${patientId}`);
  return { success: true };
}

const LOCATION_KINDS = ["escola", "domicilio", "comunidade", "outro"] as const;

/** Registro de sessão de AT em campo: horas, local, evolução do AT. */
export async function createAtSession(patientId: string, formData: FormData): Promise<ActionResult> {
  const modalityId = String(formData.get("modality_id") ?? "");
  const sessionDate = String(formData.get("session_date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const locationKind = String(formData.get("location_kind") ?? "");
  const schoolContactId = String(formData.get("school_contact_id") ?? "").trim() || null;
  const locationDetail = String(formData.get("location_detail") ?? "").trim() || null;
  const evolution = String(formData.get("evolution") ?? "").trim();

  if (!modalityId) return { success: false, error: "Selecione a modalidade do atendimento." };
  if (!sessionDate) return { success: false, error: "Informe a data da sessão." };
  if (!startTime || !endTime || endTime <= startTime) {
    return { success: false, error: "Informe um horário de início e término válidos." };
  }
  if (!LOCATION_KINDS.includes(locationKind as (typeof LOCATION_KINDS)[number])) {
    return { success: false, error: "Selecione o local do atendimento." };
  }
  if (locationKind === "escola" && !schoolContactId) {
    return { success: false, error: "Selecione a escola cadastrada para este local." };
  }
  if (!evolution) return { success: false, error: "Registre a evolução do AT." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { data: patient } = await supabase.from("patients").select("clinic_id").eq("id", patientId).maybeSingle();
  if (!patient) return { success: false, error: "Paciente não encontrado." };

  const { error } = await supabase.from("at_sessions").insert({
    clinic_id: patient.clinic_id,
    patient_id: patientId,
    professional_id: user.id,
    modality_id: modalityId,
    session_date: sessionDate,
    start_time: startTime,
    end_time: endTime,
    location_kind: locationKind,
    school_contact_id: locationKind === "escola" ? schoolContactId : null,
    location_detail: locationDetail,
    evolution,
    created_by: user.id,
  });

  if (error) {
    return {
      success: false,
      error: "Não foi possível registrar a sessão — confira se você está habilitado para AT e vinculado a este paciente.",
    };
  }

  revalidatePath(`/at/pacientes/${patientId}`);
  return { success: true };
}

/** Orientação de professores — external_contact_logs(channel='orientacao_professor'). */
export async function createTeacherOrientation(
  patientId: string,
  schoolContactId: string,
  formData: FormData,
): Promise<ActionResult> {
  const summary = String(formData.get("summary") ?? "").trim();
  const atSessionId = String(formData.get("at_session_id") ?? "").trim() || null;

  if (!summary) return { success: false, error: "Descreva a orientação dada aos professores." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const { error } = await supabase.from("external_contact_logs").insert({
    external_contact_id: schoolContactId,
    contacted_by: user.id,
    channel: "orientacao_professor",
    summary,
    at_session_id: atSessionId,
  });

  if (error) return { success: false, error: "Não foi possível registrar a orientação." };

  revalidatePath(`/at/pacientes/${patientId}`);
  return { success: true };
}

type GenerateReportResult = { success: true; documentId: string } | { success: false; error: string };

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");

/**
 * Relatório de AT para a escola (PDF timbrado) — mesmo fluxo já maduro de
 * app/terapeuta/paciente/[patientId]/relatorio-convenio/actions.ts: renderiza,
 * anexa como `documents` (category='relatorio_at_escola') e loga o
 * compartilhamento em external_contact_logs.
 */
export async function generateSchoolReport(
  patientId: string,
  schoolContactId: string,
  periodStart: string,
  periodEnd: string,
): Promise<GenerateReportResult> {
  if (!periodStart || !periodEnd || periodEnd < periodStart) {
    return { success: false, error: "Selecione um período válido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Sessão expirada — faça login de novo." };

  const [{ data: patient }, { data: school }, { data: professional }] = await Promise.all([
    supabase.from("patients").select("id, full_name, birth_date, clinic_id").eq("id", patientId).maybeSingle(),
    supabase.from("external_contacts").select("name, role_title").eq("id", schoolContactId).maybeSingle(),
    supabase.from("profiles").select("full_name, council_type, council_number").eq("id", user.id).maybeSingle(),
  ]);
  if (!patient) return { success: false, error: "Paciente não encontrado." };
  if (!school) return { success: false, error: "Escola não encontrada." };

  const clinic = await getClinicIdentity(supabase, patient.clinic_id);

  const { data: sessionRows } = await supabase
    .from("at_sessions")
    .select("session_date, start_time, end_time, location_kind, evolution, at_modalities(name)")
    .eq("patient_id", patientId)
    .gte("session_date", periodStart)
    .lte("session_date", periodEnd)
    .order("session_date");

  const sessions: AtSchoolReportSession[] = (sessionRows ?? []).map((s) => {
    const modality = Array.isArray(s.at_modalities) ? s.at_modalities[0] : s.at_modalities;
    return {
      date: fmtDate(s.session_date),
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
      locationKind: s.location_kind,
      modalityName: modality?.name ?? "—",
      evolution: s.evolution,
    };
  });

  const { data: orientationRows } = await supabase
    .from("external_contact_logs")
    .select("contacted_at, summary")
    .eq("external_contact_id", schoolContactId)
    .eq("channel", "orientacao_professor")
    .gte("contacted_at", `${periodStart}T00:00:00`)
    .lte("contacted_at", `${periodEnd}T23:59:59`)
    .order("contacted_at");

  const orientations = (orientationRows ?? []).map((o) => ({
    date: new Date(o.contacted_at).toLocaleDateString("pt-BR"),
    summary: o.summary,
  }));

  let pdfBuffer: Buffer;
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT_EXCEEDED")), 25000),
    );

    const pdfRenderPromise = renderToBuffer(
      AtSchoolReportDocument({
        clinic,
        patientName: patient.full_name,
        birthDate: fmtDate(patient.birth_date),
        schoolName: school.name,
        schoolRoleTitle: school.role_title,
        periodStart: fmtDate(periodStart),
        periodEnd: fmtDate(periodEnd),
        sessions,
        orientations,
        professionalName: professional?.full_name ?? "—",
        professionalCouncil: [professional?.council_type, professional?.council_number].filter(Boolean).join(" "),
        generatedAt: new Date().toLocaleString("pt-BR"),
      }),
    );

    pdfBuffer = await Promise.race([pdfRenderPromise, timeoutPromise]);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "";
    if (errorMsg === "TIMEOUT_EXCEEDED") {
      return {
        success: false,
        error: "O servidor está demorando mais que o esperado para gerar o PDF. Tente novamente ou filtre um período menor.",
      };
    }
    return { success: false, error: "Não foi possível gerar o PDF. Tente de novo." };
  }

  const documentId = randomUUID();
  const storagePath = `${patientId}/${documentId}/relatorio-at-escola-${periodStart}-a-${periodEnd}.pdf`;

  const { error: insertError } = await supabase.from("documents").insert({
    id: documentId,
    patient_id: patientId,
    category: "relatorio_at_escola",
    storage_path: storagePath,
    uploaded_by: user.id,
    shared_with_family: false,
  });

  if (insertError) {
    return { success: false, error: "Você não tem permissão para anexar relatório a este paciente." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    await rollbackInsertedDocument(documentId);
    return { success: false, error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY configurada — avise o time técnico." };
  }

  const { error: uploadError } = await admin.storage
    .from("clinic-documents")
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    await rollbackInsertedDocument(documentId);
    return { success: false, error: "Não foi possível salvar o PDF gerado. Tente de novo." };
  }

  await supabase.from("external_contact_logs").insert({
    external_contact_id: schoolContactId,
    contacted_by: user.id,
    channel: "relatorio_compartilhado",
    summary: `Relatório de AT enviado à escola — período ${fmtDate(periodStart)} a ${fmtDate(periodEnd)}.`,
    document_id: documentId,
  });

  revalidatePath(`/at/pacientes/${patientId}`);
  return { success: true, documentId };
}

/** Mesma compensação de relatorio-convenio/actions.ts — linha órfã se o upload falhar depois do insert. */
async function rollbackInsertedDocument(documentId: string) {
  try {
    const admin = createAdminClient();
    await admin.from("documents").delete().eq("id", documentId);
  } catch {
    // Sem admin client não há como reverter; erro principal já é retornado.
  }
}
