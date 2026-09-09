"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { success: true } | { success: false; error: string };

function revalidatePatient(patientId: string) {
  revalidatePath(`/recepcao/pacientes/${patientId}/gestao`);
  // A ficha de recepção (app/recepcao/pacientes/[id]) mostra os mesmos dados
  // básicos do paciente (nome/nascimento/telefone) via EditBasicsForm — as
  // duas telas precisam ficar em sincronia depois de qualquer escrita aqui.
  revalidatePath(`/recepcao/pacientes/${patientId}`);
}

export async function addPatientTag(patientId: string, formData: FormData): Promise<ActionResult> {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { success: false, error: "Digite um nome para a tag." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("patient_tags")
    .insert({ patient_id: patientId, label, created_by: user?.id ?? null });

  if (error) return { success: false, error: "Não foi possível adicionar a tag." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function removePatientTag(patientId: string, tagId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("patient_tags").delete().eq("id", tagId);
  if (error) return { success: false, error: "Não foi possível remover a tag." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function addPatientInsurance(patientId: string, formData: FormData): Promise<ActionResult> {
  const insurerId = String(formData.get("insurer_id") ?? "");
  const planName = String(formData.get("plan_name") ?? "").trim();
  const cardNumber = String(formData.get("card_number") ?? "").trim();

  if (!insurerId) return { success: false, error: "Selecione um convênio." };

  const supabase = await createClient();
  const { error } = await supabase.from("patient_insurance").insert({
    patient_id: patientId,
    insurer_id: insurerId,
    plan_name: planName || null,
    card_number: cardNumber || null,
    is_private: false,
  });

  if (error) return { success: false, error: "Não foi possível adicionar o convênio." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function updatePatientInsurance(patientId: string, patientInsuranceId: string, formData: FormData): Promise<ActionResult> {
  const insurerId = String(formData.get("insurer_id") ?? "");
  const planName = String(formData.get("plan_name") ?? "").trim();
  const cardNumber = String(formData.get("card_number") ?? "").trim();

  if (!insurerId) return { success: false, error: "Selecione um convênio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("patient_insurance")
    .update({ insurer_id: insurerId, plan_name: planName || null, card_number: cardNumber || null })
    .eq("id", patientInsuranceId);

  if (error) return { success: false, error: "Não foi possível atualizar o convênio." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function deletePatientInsurance(patientId: string, patientInsuranceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("patient_insurance").delete().eq("id", patientInsuranceId);

  if (error) {
    return {
      success: false,
      error: "Não foi possível remover o convênio (pode haver autorizações vinculadas a ele).",
    };
  }

  revalidatePatient(patientId);
  return { success: true };
}

export async function addPatientCharge(patientId: string, formData: FormData): Promise<ActionResult> {
  const description = String(formData.get("description") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").replace(",", ".");
  const amount = Number(amountRaw);
  const dueDate = String(formData.get("due_date") ?? "");

  if (!description || !amountRaw || !Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Preencha a descrição e um valor válido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("patient_charges").insert({
    patient_id: patientId,
    description,
    amount,
    due_date: dueDate || null,
    created_by: user?.id ?? null,
  });

  if (error) return { success: false, error: "Não foi possível registrar a cobrança." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function markChargePaid(patientId: string, chargeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patient_charges")
    .update({ status: "pago", paid_at: new Date().toISOString() })
    .eq("id", chargeId);

  if (error) return { success: false, error: "Não foi possível marcar a cobrança como paga." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function cancelCharge(patientId: string, chargeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("patient_charges").update({ status: "cancelado" }).eq("id", chargeId);

  if (error) return { success: false, error: "Não foi possível cancelar a cobrança." };

  revalidatePatient(patientId);
  return { success: true };
}

export async function updatePatientBasics(patientId: string, formData: FormData): Promise<ActionResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const birthDate = String(formData.get("birth_date") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const guardianId = String(formData.get("guardian_id") ?? "");
  const complaint = String(formData.get("complaint") ?? "").trim();
  const cid = String(formData.get("cid") ?? "").trim();
  const supportLevel = String(formData.get("support_level") ?? "").trim();
  const entrySource = String(formData.get("entry_source") ?? "").trim();

  if (!fullName || !birthDate) {
    return { success: false, error: "Preencha nome e data de nascimento." };
  }

  const supabase = await createClient();

  const { error: patientError } = await supabase
    .from("patients")
    .update({
      full_name: fullName,
      birth_date: birthDate,
      complaint: complaint || null,
      cid: cid || null,
      support_level: supportLevel || null,
      entry_source: entrySource || null,
    })
    .eq("id", patientId);

  if (patientError) return { success: false, error: "Não foi possível atualizar os dados do paciente." };

  if (phone && guardianId) {
    const { error: guardianError } = await supabase.from("guardians").update({ phone }).eq("id", guardianId);
    if (guardianError) return { success: false, error: "Paciente salvo, mas houve erro ao atualizar o telefone." };
  }

  revalidatePatient(patientId);
  return { success: true };
}

/**
 * Equipe de avaliação (Módulo 3 MAAIS, slide 23): terapeuta avaliador ou
 * supervisor de área, vinculados via `patient_access` com
 * `access_type='terapeuta'` (mantém a RLS de prontuário/PTS/protocolos
 * funcionando pra esse profissional) e `role_in_team` marcando o papel
 * específico na equipe deste paciente. Um trigger de banco conclui a etapa
 * `equipe_definida` do checklist assim que houver ao menos 1
 * terapeuta_avaliador e 1 supervisor_area ativos.
 */
export async function addTeamMember(patientId: string, formData: FormData): Promise<ActionResult> {
  const profileId = String(formData.get("profile_id") ?? "");
  const roleInTeam = String(formData.get("role_in_team") ?? "");
  const discipline = String(formData.get("discipline") ?? "").trim();

  if (!profileId || !["terapeuta_avaliador", "supervisor_area"].includes(roleInTeam)) {
    return { success: false, error: "Selecione o terapeuta e o papel na equipe." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("patient_access").insert({
    patient_id: patientId,
    profile_id: profileId,
    access_type: "terapeuta",
    role_in_team: roleInTeam,
    discipline: discipline || null,
    granted_by: user?.id ?? null,
  });

  if (error) return { success: false, error: "Não foi possível adicionar este terapeuta à equipe." };

  revalidatePatient(patientId);
  revalidatePath("/supervisao");
  return { success: true };
}

export async function revokeTeamMember(patientId: string, patientAccessId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patient_access")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", patientAccessId);

  if (error) return { success: false, error: "Não foi possível remover este terapeuta da equipe." };

  revalidatePatient(patientId);
  revalidatePath("/supervisao");
  return { success: true };
}

export async function setPatientArchived(patientId: string, archived: boolean): Promise<ActionResult> {
  const supabase = await createClient();

  if (archived) {
    const { error } = await supabase.from("patients").update({ status: "arquivado" }).eq("id", patientId);
    if (error) return { success: false, error: "Não foi possível arquivar o paciente." };
  } else {
    // Não existe coluna que guarde o status anterior ao arquivamento —
    // reconstrói a partir do audit_log (mesmo princípio de
    // patient_status_as_of, 20260904000013) em vez de forçar 'ativo' pra
    // todo mundo, o que promovia até quem só era 'interessado'/'avaliacao'
    // direto pro fim do funil de entrada. audit_log_read só libera pra
    // gestor — quem desarquiva normalmente é a recepção, então usa o
    // admin client só pra esta leitura pontual (mesmo padrão de
    // lib/anamnesis-prefill.ts).
    const admin = createAdminClient();
    const { data: lastArchiveEntry } = await admin
      .from("audit_log")
      .select("before")
      .eq("table_name", "patients")
      .eq("row_id", patientId)
      .eq("action", "UPDATE")
      .contains("after", { status: "arquivado" })
      .order("at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const before = lastArchiveEntry?.before as { status?: string } | null;
    const restoredStatus = before?.status ?? "ativo";

    const { error } = await supabase.from("patients").update({ status: restoredStatus }).eq("id", patientId);
    if (error) return { success: false, error: "Não foi possível reativar o paciente." };
  }

  revalidatePatient(patientId);
  revalidatePath("/gestor/cadastros/pacientes");
  return { success: true };
}

/**
 * Convite para a família preencher a ficha do paciente por link público
 * (app/ficha/[token]). Escrita normal, autenticada: a RLS de
 * `patient_intake_form_tokens` já limita a recepção/supervisão/gestão, então
 * aqui não entra service-role — quem usa service-role é só a rota pública,
 * que não tem sessão.
 *
 * Gerar um link novo revoga os anteriores ainda abertos: dois convites vivos
 * para o mesmo paciente significam dois links circulando no WhatsApp da
 * família, e o antigo é justamente o que costuma vazar.
 */
export async function createIntakeFormLink(
  patientId: string,
): Promise<{ success: true; path: string } | { success: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("patient_intake_form_tokens")
    .update({ active: false, revoked_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .is("submitted_at", null)
    .eq("active", true);

  const { data, error } = await supabase
    .from("patient_intake_form_tokens")
    .insert({ patient_id: patientId, created_by: user?.id ?? null })
    .select("token")
    .single();

  if (error || !data) {
    return { success: false, error: "Não foi possível gerar o link da ficha." };
  }

  // Devolve o caminho, não a URL absoluta: o projeto não tem env de host
  // (nem helper de origin no servidor) e quem chama roda no navegador, onde
  // `window.location.origin` já é a resposta certa — mesmo caminho que
  // lib/print-coupon.ts usa para absolutizar o logo do cupom.
  revalidatePatient(patientId);
  return { success: true, path: `/ficha/${data.token}` };
}

export async function revokeIntakeFormLink(
  patientId: string,
  tokenId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("patient_intake_form_tokens")
    .update({ active: false, revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("patient_id", patientId);

  if (error) return { success: false, error: "Não foi possível revogar o link." };

  revalidatePatient(patientId);
  return { success: true };
}
