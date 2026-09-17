"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { zonedDateTimeToUtc } from "@/lib/timezone";
import { getActiveAuthorizationId } from "@/lib/active-authorization";
import { WEEKDAY_LABELS, toHourMinute } from "@/lib/aba-training";

/**
 * Mensagens dos guards de Treino ABA (trigger
 * `appointments_aba_training_guard`, 20260910020000_aba_training.sql). Vale a
 * mesma tradução que já existia pro guard de autorização: a regra mora no
 * banco, a UI só traduz.
 */
function mapAbaGuardError(message: string): string | null {
  if (message.includes("lotada")) {
    return "Turma de Treino ABA lotada nesse dia — todas as vagas da sala já estão ocupadas.";
  }
  if (message.includes("já está nessa turma")) {
    return "Este paciente já está agendado nessa turma nesse dia.";
  }
  if (message.includes("saldo ABA insuficiente")) {
    return "Saldo das guias ABA não cobre um bloco de 2h (3 sessões).";
  }
  if (message.includes("Treino ABA")) {
    return "Agendamento de Treino ABA inválido — confira turma, dia e horário.";
  }
  return null;
}

/**
 * Mensagens do guard de psicoterapia em grupo (trigger
 * `appointments_group_capacity_guard`, 20260917170400_group_psychotherapy_guard.sql).
 * A regra (limite de vagas, faixa etária de até 2 anos) mora inteira no
 * banco — o texto depois dos dois-pontos já vem pronto em português, então
 * só prefixamos com o rótulo do tipo de bloqueio.
 */
function mapGroupGuardError(message: string): string | null {
  if (message.startsWith("GRUPO_LOTADO:")) {
    return `Grupo lotado — ${message.slice("GRUPO_LOTADO:".length).trim()}`;
  }
  if (message.startsWith("GRUPO_FAIXA_ETARIA:")) {
    return `Faixa etária incompatível — ${message.slice("GRUPO_FAIXA_ETARIA:".length).trim()}`;
  }
  return null;
}

/**
 * Mensagem do guard de guia prévia obrigatória (trigger
 * `appointments_prior_auth_guard`, mesma migration acima) — convênio numa
 * especialidade que exige guia prévia não pode nem ser agendado sem
 * autorização ativa cobrindo a data da sessão.
 */
function mapPriorAuthGuardError(message: string): string | null {
  if (message.startsWith("GUIA_OBRIGATORIA:")) {
    return `Guia obrigatória — ${message.slice("GUIA_OBRIGATORIA:".length).trim()}`;
  }
  return null;
}

export async function createAppointment(
  formData: FormData,
): Promise<{ success: true; appointmentId: string } | { success: false; error: string }> {
  const patientId = String(formData.get("patient_id") ?? "");
  const therapistId = String(formData.get("therapist_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const appointmentTypeId = String(formData.get("appointment_type_id") ?? "").trim();
  const abaClassId = String(formData.get("aba_class_id") ?? "").trim();
  // Presente em app/recepcao/nova-sessao-dialog.tsx desde sempre, mas nunca
  // era lido aqui — o valor escolhido pela recepção era descartado e toda
  // sessão ficava com o default 'individual' da coluna.
  const modality = String(formData.get("modality") ?? "individual").trim() || "individual";
  // "Provisória" (Recepcao.dc.html): recepção agenda mesmo sem guia vigente;
  // is_provisional=true isola essa sessão do guard de autorização quando ela
  // for fechada como 'realizada' (ver appointments_authorization_guard e o
  // checkOut em session-actions.ts, que preserva essa marcação).
  const isProvisional = formData.get("is_provisional") === "on";

  let roomId = String(formData.get("room_id") ?? "");
  let time = String(formData.get("time") ?? "");

  if (!patientId || !therapistId || !date || !appointmentTypeId) {
    return { success: false, error: "Preencha todos os campos." };
  }

  const supabase = await createClient();

  // Duração da sessão vem do catálogo cadastrado em /gestor/cadastros/tipos-atendimento
  // (app/gestor/cadastros/tipos-atendimento), não mais de um valor fixo de 50min — permite
  // que cada tipo de atendimento (fono, aba, avaliação…) tenha sua própria
  // duração padrão.
  const { data: appointmentType } = await supabase
    .from("appointment_types")
    .select("id, name, duration_minutes, aba_role")
    .eq("id", appointmentTypeId)
    .maybeSingle();

  if (!appointmentType) {
    return { success: false, error: "Tipo de atendimento inválido." };
  }

  const isAbaTraining = appointmentType.aba_role === "treino";

  // Treino ABA não é agendado por sala+horário livres: ele é um encaixe numa
  // TURMA fixa (sala própria + dia da semana + entrada às 8/10/14/16h). Sala
  // e horário vêm da turma, nunca do formulário, e a modalidade é sempre
  // 'grupo' — é o que libera as exclusion constraints de sala/terapeuta
  // (20260904000006_appointments.sql) pro atendimento coletivo.
  let effectiveModality = modality;
  if (isAbaTraining) {
    if (!abaClassId) {
      return { success: false, error: "Selecione a turma de Treino ABA." };
    }

    const { data: abaClass } = await supabase
      .from("aba_training_classes")
      .select("id, room_id, day_of_week, start_time, active")
      .eq("id", abaClassId)
      .maybeSingle();

    if (!abaClass || !abaClass.active) {
      return { success: false, error: "Turma de Treino ABA inválida ou inativa." };
    }

    const [year, month, day] = date.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== abaClass.day_of_week) {
      return {
        success: false,
        error: `Essa turma só acontece na ${WEEKDAY_LABELS[abaClass.day_of_week].toLowerCase()} — escolha uma data compatível.`,
      };
    }

    roomId = abaClass.room_id;
    time = toHourMinute(abaClass.start_time);
    effectiveModality = "grupo";
  } else if (abaClassId) {
    return { success: false, error: "Turma só se aplica a Treino ABA." };
  }

  if (!roomId || !time) {
    return { success: false, error: "Preencha todos os campos." };
  }

  const startsAt = zonedDateTimeToUtc(date, time, CLINIC_TIMEZONE);
  const endsAt = new Date(startsAt.getTime() + appointmentType.duration_minutes * 60 * 1000);

  // `resolve_procedure_code` traduz paciente+especialidade pro código de
  // procedimento cadastrado pra operadora dele (insurer_procedure_codes) —
  // null pra particular ou convênio sem código cadastrado ainda. Precisa vir
  // antes da busca de guia pra achar a autorização certa quando o paciente
  // tem guias de mais de uma disciplina (ex.: fono e TO), cada uma com seu
  // próprio saldo.
  const { data: procedureCode } = isAbaTraining
    ? { data: null as string | null }
    : await supabase.rpc("resolve_procedure_code", {
        p_patient_id: patientId,
        p_specialty: appointmentType.name,
      });

  // Sessões criadas pela agenda são sempre sessões normais (não avaliação —
  // essas são criadas por `scheduleEvaluation`), então precisam de
  // authorization_id pra satisfazer o guard `appointments_authorization_guard`
  // quando marcadas como 'realizada'. Treino ABA é a exceção: não consome uma
  // guia só, e sim 3 sessões rateadas entre as guias ABA no fechamento
  // (`aba_training_consume_pool`) — por isso vai sem authorization_id.
  const authorizationId = isAbaTraining
    ? null
    : await getActiveAuthorizationId(supabase, patientId, procedureCode ?? null);

  // Sessão de acolhimento (FASE 4): repassada por scheduleAcolhimento
  // (app/recepcao/acolhimentos/actions.ts) via campo oculto do form, marca a
  // sessão como 1ª avaliação — mesma flag que o resto da agenda usa pra
  // identificar avaliação inicial (ver is_evaluation em outros pontos do
  // schema, ex.: buildAuthorizationWarning em session-actions.ts).
  const isEvaluation = formData.get("is_evaluation") === "on" || formData.get("is_evaluation") === "true";

  const { data: insertedAppointment, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      therapist_id: therapistId,
      room_id: roomId,
      discipline: appointmentType.name,
      appointment_type_id: appointmentType.id,
      modality: effectiveModality,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "agendada",
      authorization_id: authorizationId,
      aba_class_id: isAbaTraining ? abaClassId : null,
      is_provisional: isProvisional,
      is_evaluation: isEvaluation,
    })
    .select("id")
    .single();

  if (error || !insertedAppointment) {
    const abaError = error?.message ? mapAbaGuardError(error.message) : null;
    if (abaError) {
      return { success: false, error: abaError };
    }
    const groupError = error?.message ? mapGroupGuardError(error.message) : null;
    if (groupError) {
      return { success: false, error: groupError };
    }
    const priorAuthError = error?.message ? mapPriorAuthGuardError(error.message) : null;
    if (priorAuthError) {
      return { success: false, error: priorAuthError };
    }
    if (error?.code === "23P01") {
      return {
        success: false,
        error: "Sala ou terapeuta já tem sessão nesse horário.",
      };
    }
    if (error?.message?.includes("exige authorization_id")) {
      return {
        success: false,
        error: "Paciente sem autorização ativa — registre uma guia antes de agendar.",
      };
    }
    if (error?.message?.includes("janela de disponibilidade")) {
      return {
        success: false,
        error: "Terapeuta fora da janela de disponibilidade cadastrada nesse horário.",
      };
    }
    return { success: false, error: "Não foi possível agendar. Tente de novo." };
  }

  revalidatePath("/recepcao/agenda");
  revalidatePath("/recepcao");
  return { success: true, appointmentId: insertedAppointment.id };
}
