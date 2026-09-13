"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_CLINIC_ID, CLINIC_TIMEZONE } from "@/lib/constants";
import { normalizePhone } from "@/lib/document-extraction";
import { zonedDateTimeToUtc } from "@/lib/timezone";

export type CreatePresencialAcolhimentoInput = {
  // Paciente
  patientFullName: string;
  patientBirthDate: string; // YYYY-MM-DD
  patientCpf?: string;
  patientSexo?: string;
  patientCid?: string;
  patientSupportLevel?: string;
  patientMedication?: string;
  patientAllergies?: string;
  patientComorbidities?: string;
  // Responsável
  guardianFullName: string;
  guardianPhone: string;
  guardianCpf?: string;
  guardianRelationship?: string;
  // Convênio & Guia Autorizada
  insurerId: string;
  planName?: string;
  cardNumber?: string;
  cardValidUntil?: string;
  guideNumber: string;
  procedureCode?: string;
  sessionsAuthorized?: number;
  validFrom?: string;
  validTo?: string;
  authorizationPassword?: string;
  // Checklist de Documentos Impressos na Recepção
  documentsChecked: {
    printedDocs: boolean;
    medicalLaudo: boolean;
    authorizedGuide: boolean;
  };
  // Agendamento Imediato (opcional)
  scheduleNow?: boolean;
  appointmentDetails?: {
    therapistId: string;
    roomId: string;
    date: string;
    time: string;
  };
};

export type CreatePresencialAcolhimentoResult =
  | {
      success: true;
      leadId: string;
      patientId: string;
      scheduled: boolean;
      appointmentId?: string;
      appointmentInfo?: {
        therapistName?: string;
        roomName?: string;
        date: string;
        time: string;
      };
      message: string;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Cadastra manualmente um acolhimento presencial na recepção quando o cliente
 * chega fisicamente à clínica com documentos impressos, laudo médico e guia autorizada.
 */
export async function createPresencialAcolhimentoAction(
  input: CreatePresencialAcolhimentoInput,
): Promise<CreatePresencialAcolhimentoResult> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    // 1. Validações básicas
    if (!input.patientFullName.trim()) {
      return { success: false, error: "Nome do paciente é obrigatório." };
    }
    if (!input.patientBirthDate.trim()) {
      return { success: false, error: "Data de nascimento do paciente é obrigatória." };
    }
    if (!input.guardianFullName.trim()) {
      return { success: false, error: "Nome do responsável é obrigatório." };
    }
    if (!input.guardianPhone.trim()) {
      return { success: false, error: "Telefone do responsável é obrigatório." };
    }
    if (!input.insurerId) {
      return { success: false, error: "Selecione o plano de saúde/convênio." };
    }
    if (!input.guideNumber.trim()) {
      return { success: false, error: "Número da guia autorizada é obrigatório." };
    }

    const phoneE164 = normalizePhone(input.guardianPhone) || input.guardianPhone.trim();

    // 2. Criar ou Vincular Paciente
    const { data: patient, error: patientErr } = await supabase
      .from("patients")
      .insert({
        clinic_id: DEV_CLINIC_ID,
        full_name: input.patientFullName.trim(),
        birth_date: input.patientBirthDate,
        cpf: input.patientCpf?.trim() || null,
        sexo: input.patientSexo || null,
        cid: input.patientCid?.trim() || null,
        support_level: input.patientSupportLevel?.trim() || null,
        medication: input.patientMedication?.trim() || null,
        allergies: input.patientAllergies?.trim() || null,
        comorbidities: input.patientComorbidities?.trim() || null,
        status: "interessado",
        entry_source: "Acolhimento Presencial (Recepção)",
      })
      .select("id")
      .single();

    if (patientErr || !patient) {
      console.error("Erro ao criar paciente presencial:", patientErr);
      return { success: false, error: patientErr?.message || "Falha ao cadastrar paciente." };
    }

    // 3. Criar Responsável
    const { data: guardian, error: guardianErr } = await supabase
      .from("guardians")
      .insert({
        patient_id: patient.id,
        full_name: input.guardianFullName.trim(),
        phone: phoneE164,
        cpf: input.guardianCpf?.trim() || null,
        relationship: input.guardianRelationship?.trim() || "Mãe/Pai/Responsável",
        is_emergency_contact: true,
        is_financial: true,
      })
      .select("id")
      .single();

    if (guardianErr || !guardian) {
      console.error("Erro ao criar responsável:", guardianErr);
    }

    // 4. Cadastrar Convênio do Paciente (patient_insurance)
    const { data: patientInsurance, error: insuranceErr } = await supabase
      .from("patient_insurance")
      .insert({
        patient_id: patient.id,
        insurer_id: input.insurerId,
        plan_name: input.planName?.trim() || null,
        card_number: input.cardNumber?.trim() || null,
        card_valid_until: input.cardValidUntil || null,
        is_private: false,
      })
      .select("id")
      .single();

    if (insuranceErr || !patientInsurance) {
      console.error("Erro ao vincular convênio:", insuranceErr);
    }

    // 5. Cadastrar Guia Autorizada (authorizations)
    let authorizationId: string | null = null;
    if (patientInsurance) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const { data: authRow, error: authErr } = await supabase
        .from("authorizations")
        .insert({
          patient_insurance_id: patientInsurance.id,
          guide_number: input.guideNumber.trim(),
          procedure_code: input.procedureCode?.trim() || "40101010",
          sessions_authorized: input.sessionsAuthorized || 10,
          sessions_used: 0,
          valid_from: input.validFrom || todayIso,
          valid_to: input.validTo || "2099-12-31",
          authorization_password: input.authorizationPassword?.trim() || null,
          status: "ativa",
        })
        .select("id")
        .single();

      if (!authErr && authRow) {
        authorizationId = authRow.id;
      } else if (authErr) {
        console.error("Erro ao criar autorização:", authErr);
      }
    }

    // 6. Localizar ou Criar Lote de Entrada para Acolhimentos Presenciais
    let batchId: string | null = null;
    const { data: existingBatch } = await supabase
      .from("insurance_intake_batches")
      .select("id")
      .eq("clinic_id", DEV_CLINIC_ID)
      .eq("original_name", "Acolhimento Presencial - Recepção")
      .limit(1)
      .maybeSingle();

    if (existingBatch) {
      batchId = existingBatch.id;
    } else {
      const { data: newBatch, error: batchErr } = await admin
        .from("insurance_intake_batches")
        .insert({
          clinic_id: DEV_CLINIC_ID,
          insurer_id: input.insurerId,
          original_name: "Acolhimento Presencial - Recepção",
          storage_path: "intake/presencial/batch.pdf",
          mime_type: "application/pdf",
          size_bytes: 0,
          status: "done",
          leads_count: 1,
        })
        .select("id")
        .single();

      if (!batchErr && newBatch) {
        batchId = newBatch.id;
      }
    }

    if (!batchId) {
      return { success: false, error: "Falha ao vincular lote de acolhimento presencial." };
    }

    // 7. Determinar status do Acolhimento Lead
    const allDocsChecked =
      input.documentsChecked.printedDocs &&
      input.documentsChecked.medicalLaudo &&
      input.documentsChecked.authorizedGuide;

    const leadStatus = allDocsChecked ? "awaiting_slot" : "pending_supervisor";

    // 8. Inserir em insurance_intake_leads com metadata PRESENCIAL
    const { data: leadRow, error: leadErr } = await admin
      .from("insurance_intake_leads")
      .insert({
        clinic_id: DEV_CLINIC_ID,
        batch_id: batchId,
        row_index: 0,
        insurer_id: input.insurerId,
        patient_id: patient.id,
        guardian_id: guardian?.id || null,
        patient_insurance_id: patientInsurance?.id || null,
        authorization_id: authorizationId,
        patient_full_name: input.patientFullName.trim(),
        patient_birth_date: input.patientBirthDate,
        patient_cpf: input.patientCpf?.trim() || null,
        patient_sexo: input.patientSexo || null,
        patient_cid: input.patientCid?.trim() || null,
        guardian_full_name: input.guardianFullName.trim(),
        guardian_phone_raw: input.guardianPhone.trim(),
        phone_e164: phoneE164,
        guardian_cpf: input.guardianCpf?.trim() || null,
        guardian_relationship: input.guardianRelationship?.trim() || "Mãe/Pai/Responsável",
        plan_name: input.planName?.trim() || null,
        card_number: input.cardNumber?.trim() || null,
        card_valid_until: input.cardValidUntil || null,
        guide_number: input.guideNumber.trim(),
        procedure_code: input.procedureCode?.trim() || null,
        sessions_authorized: input.sessionsAuthorized || 10,
        valid_from: input.validFrom || null,
        valid_to: input.validTo || null,
        authorization_password: input.authorizationPassword?.trim() || null,
        status: leadStatus,
        extra: {
          is_presencial: true,
          entry_channel: "presencial",
          documents_checked: input.documentsChecked,
          registered_at_reception: true,
          created_at_reception: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (leadErr || !leadRow) {
      console.error("Erro ao criar lead de acolhimento presencial:", leadErr);
      return { success: false, error: leadErr?.message || "Falha ao registrar acolhimento presencial." };
    }

    let scheduled = false;
    let appointmentId: string | undefined = undefined;
    let appointmentInfo:
      | { therapistName?: string; roomName?: string; date: string; time: string }
      | undefined = undefined;

    // 9. Agendamento Imediato da 1ª Avaliação se solicitado
    if (input.scheduleNow && input.appointmentDetails) {
      const { therapistId, roomId, date, time } = input.appointmentDetails;
      if (therapistId && roomId && date && time) {
        const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
        const endsAt = new Date(startsAt.getTime() + 50 * 60_000);

        const { data: appt, error: apptErr } = await supabase
          .from("appointments")
          .insert({
            patient_id: patient.id,
            therapist_id: therapistId,
            room_id: roomId,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            is_evaluation: true,
            discipline: "Avaliação Inicial",
            status: "agendada",
            authorization_id: authorizationId,
          })
          .select("id")
          .single();

        if (!apptErr && appt) {
          scheduled = true;
          appointmentId = appt.id;

          // Atualiza o lead como agendado
          await admin
            .from("insurance_intake_leads")
            .update({
              status: "scheduled",
              appointment_id: appt.id,
              scheduled_at: new Date().toISOString(),
            })
            .eq("id", leadRow.id);

          // Buscar nomes para o comprovante
          const [{ data: profile }, { data: room }] = await Promise.all([
            supabase.from("profiles").select("full_name").eq("id", therapistId).maybeSingle(),
            supabase.from("rooms").select("name").eq("id", roomId).maybeSingle(),
          ]);

          appointmentInfo = {
            therapistName: profile?.full_name || undefined,
            roomName: room?.name || undefined,
            date,
            time,
          };
        } else {
          console.error("Erro ao realizar agendamento imediato da 1ª avaliação:", apptErr);
        }
      }
    }

    revalidatePath("/recepcao");
    revalidatePath("/recepcao/agenda");
    revalidatePath("/supervisao");

    const message = scheduled
      ? `Acolhimento presencial cadastrado e 1ª Avaliação agendada com sucesso para ${appointmentInfo?.date} às ${appointmentInfo?.time}!`
      : `Acolhimento presencial cadastrado com sucesso! Encaminhado com PRIORIDADE ALTA para o Supervisor realizar o agendamento.`;

    return {
      success: true,
      leadId: leadRow.id,
      patientId: patient.id,
      scheduled,
      appointmentId,
      appointmentInfo,
      message,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro inesperado ao cadastrar acolhimento presencial.";
    return { success: false, error: msg };
  }
}
