// lib/whatsapp/intake.ts
/**
 * Cria/reaproveita o lead (patients+guardians+patient_insurance) coletado
 * pelo bot e armazena os PDFs (laudo/guia) no mesmo bucket privado
 * `clinic-documents` já usado por app/recepcao/pacientes/[id]/documents-actions.ts
 * — mesmas convenções de path e limite de tamanho, só que sem sessão de
 * usuário (o bot sempre grava via createAdminClient()).
 */
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { sanitizeFileName } from "@/lib/document-categories";
import { normalizeBrazilianPhone } from "@/lib/whatsapp-message";
import { onlyDigits } from "./validators";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type IntakeData = {
  guardianName: string;
  guardianCpf: string;
  guardianPhone: string; // wa_id normalizado
  childName: string;
  childCpf: string | null;
  childBirthDate: string; // YYYY-MM-DD
  insurerId: string | null; // null = particular
  isPrivate: boolean;
  cardNumber: string | null;
  entrySource?: string;
  complaint?: string;
};

export type LeadResult = { patientId: string; guardianId: string };

/**
 * Dedup por CPF da criança, CPF do responsável ou telefone normalizado —
 * nessa ordem. `createLead` (app/recepcao/pacientes/actions.ts) não faz
 * dedup nenhum; o bot precisa, porque a mesma família pode escrever de novo
 * dias depois e não queremos duplicar o cadastro nem perder o histórico.
 */
async function findExistingPatientId(
  admin: ReturnType<typeof createAdminClient>,
  clinicId: string,
  childCpf: string | null,
  guardianCpf: string,
  guardianPhone: string,
): Promise<string | null> {
  if (childCpf) {
    const { data } = await admin
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("cpf", childCpf)
      .maybeSingle();
    if (data) return data.id;
  }

  const { data: byGuardianCpf } = await admin
    .from("guardians")
    .select("patient_id, patients!inner(clinic_id)")
    .eq("cpf", guardianCpf)
    .eq("patients.clinic_id", clinicId)
    .maybeSingle();
  if (byGuardianCpf) return byGuardianCpf.patient_id;

  const { data: byPhone } = await admin
    .from("guardians")
    .select("patient_id, patients!inner(clinic_id)")
    .eq("phone", guardianPhone)
    .eq("patients.clinic_id", clinicId)
    .maybeSingle();
  if (byPhone) return byPhone.patient_id;

  return null;
}

export async function createOrReuseLead(data: IntakeData): Promise<LeadResult> {
  const admin = createAdminClient();
  const clinicId = DEV_CLINIC_ID;
  const guardianCpf = onlyDigits(data.guardianCpf);
  const guardianPhone = normalizeBrazilianPhone(data.guardianPhone);
  const childCpf = data.childCpf ? onlyDigits(data.childCpf) : null;

  const existingPatientId = await findExistingPatientId(admin, clinicId, childCpf, guardianCpf, guardianPhone);
  if (existingPatientId) {
    const { data: guardian } = await admin
      .from("guardians")
      .select("id")
      .eq("patient_id", existingPatientId)
      .limit(1)
      .maybeSingle();
    if (guardian) return { patientId: existingPatientId, guardianId: guardian.id };
  }

  const { data: patient, error: patientError } = await admin
    .from("patients")
    .insert({
      clinic_id: clinicId,
      full_name: data.childName,
      birth_date: data.childBirthDate,
      cpf: childCpf,
      status: "lead",
      entry_source: data.entrySource ?? "whatsapp_bot",
      complaint: data.complaint ?? null,
      first_contact_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (patientError || !patient) {
    throw new Error(`Não foi possível criar o paciente: ${patientError?.message}`);
  }

  const { data: guardian, error: guardianError } = await admin
    .from("guardians")
    .insert({
      patient_id: patient.id,
      full_name: data.guardianName,
      phone: guardianPhone,
      cpf: guardianCpf,
      relationship: "responsavel",
    })
    .select("id")
    .single();

  if (guardianError || !guardian) {
    throw new Error(`Paciente criado, mas falhou ao criar o responsável: ${guardianError?.message}`);
  }

  await admin.from("patient_insurance").insert({
    patient_id: patient.id,
    insurer_id: data.insurerId,
    is_private: data.isPrivate,
    card_number: data.cardNumber,
  });

  return { patientId: patient.id, guardianId: guardian.id };
}

/**
 * Sobe o PDF (laudo/guia) recebido do bot pro bucket clinic-documents e
 * insere a linha em `documents` (category laudo|autorizacao, source
 * 'whatsapp', uploaded_by null — ver migration 20260906000000). Mesmo
 * shape de app/recepcao/pacientes/[id]/documents-actions.ts uploadDocument,
 * mas sem RLS de sessão (o bot não tem usuário logado).
 */
export async function storeBotDocument(params: {
  patientId: string;
  category: "laudo" | "autorizacao";
  buffer: Buffer;
  contentType: string;
  fileName: string;
}): Promise<{ documentId: string } | { error: string }> {
  const { patientId, category, buffer, contentType, fileName } = params;

  if (contentType !== "application/pdf") {
    return { error: "not_pdf" };
  }
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return { error: "too_large" };
  }

  const admin = createAdminClient();
  const documentId = randomUUID();
  const storagePath = `${patientId}/${documentId}/${sanitizeFileName(fileName)}`;

  const { error: uploadError } = await admin.storage
    .from("clinic-documents")
    .upload(storagePath, buffer, { contentType, upsert: false });

  if (uploadError) {
    return { error: `upload_failed: ${uploadError.message}` };
  }

  const { error: insertError } = await admin.from("documents").insert({
    id: documentId,
    patient_id: patientId,
    category,
    storage_path: storagePath,
    uploaded_by: null,
    source: "whatsapp",
    shared_with_family: false,
  });

  if (insertError) {
    await admin.storage.from("clinic-documents").remove([storagePath]);
    return { error: `insert_failed: ${insertError.message}` };
  }

  return { documentId };
}
