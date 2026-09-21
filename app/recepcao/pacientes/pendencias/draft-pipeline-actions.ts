// app/recepcao/pacientes/pendencias/draft-pipeline-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Etapas 2 e 3 da linha do tempo de cada contato da fila de pendências
 * (colunas de registration_drafts criadas em 20260921050000):
 *   2) autorização junto ao plano — a clínica liga para o convênio, e só marca
 *      aqui o resultado (guia autorizada, ou "particular / sem guia");
 *   3) habilitado para agendamento — o "ok" que a Agenda 1ª Avaliação da
 *      Supervisão exige antes de deixar marcar (lib/evaluation-agenda.ts).
 * Tudo com o client de sessão: a RLS de registration_drafts já restringe o
 * update a recepção/supervisor/gestor da clínica.
 */

type ActionResult = { success: true; note?: string } | { success: false; error: string };

export type AuthorizedGuideInput = {
  guideNumber: string;
  procedureCode: string;
  sessionsAuthorized: number;
  validFrom: string;
  validTo: string;
  password: string;
  passwordValidUntil: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function refresh() {
  revalidatePath("/recepcao");
  revalidatePath("/recepcao/pacientes/pendencias");
  revalidatePath("/supervisao");
}

/** Teto de tentativas da leitura sob demanda — abrir a linha várias vezes não pode virar N chamadas ao Gemini. */
const MAX_ON_DEMAND_ATTEMPTS = 3;

/**
 * Lê com IA os arquivos de um contato que a recepção acabou de abrir na fila
 * (o cron de extração nunca rodou em produção; ver loadOpenDraftForPhone em
 * app/recepcao/atendimento/actions.ts). Só rascunhos parados em pending/failed,
 * com pelo menos um arquivo e tentativas sobrando; a reivindicação é atômica
 * (`claim_registration_drafts`), então dois cliques não processam duas vezes.
 */
export async function extractDraftOnDemand(draftId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, status, attempts, registration_draft_files(count)")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };

  const filesCount = Array.isArray(draft.registration_draft_files)
    ? ((draft.registration_draft_files[0] as { count: number } | undefined)?.count ?? 0)
    : 0;
  if ((draft.status !== "pending" && draft.status !== "failed") || filesCount === 0 || draft.attempts >= MAX_ON_DEMAND_ATTEMPTS) {
    return { success: true };
  }

  const { claimAndProcessDrafts } = await import("@/lib/registration-drafts-process");
  await claimAndProcessDrafts({ draftId });
  refresh();
  return { success: true };
}

/** Marca a etapa 2 como concluída registrando a guia que o plano autorizou. */
export async function registerAuthorizedGuide(draftId: string, input: AuthorizedGuideInput): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const guideNumber = input.guideNumber.trim();
  const procedureCode = input.procedureCode.trim();
  const sessions = Math.trunc(Number(input.sessionsAuthorized));
  if (!guideNumber) return { success: false, error: "Informe o número da guia autorizada." };
  if (!procedureCode) return { success: false, error: "Informe o procedimento autorizado." };
  if (!Number.isFinite(sessions) || sessions <= 0) return { success: false, error: "Informe quantas sessões foram autorizadas." };
  if (!ISO_DATE.test(input.validFrom) || !ISO_DATE.test(input.validTo)) {
    return { success: false, error: "Informe a vigência da guia (de/até)." };
  }
  if (input.validTo < input.validFrom) return { success: false, error: "A vigência termina antes de começar." };
  const passwordValidUntil = ISO_DATE.test(input.passwordValidUntil) ? input.passwordValidUntil : null;
  const password = input.password.trim() || null;

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, patient_id, authorization_id, scheduling_enabled_at")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };

  const guide = {
    guide_number: guideNumber,
    procedure_code: procedureCode,
    sessions_authorized: sessions,
    valid_from: input.validFrom,
    valid_to: input.validTo,
    authorization_password: password,
    password_valid_until: passwordValidUntil,
  };

  // Se o cadastro já foi conferido e o paciente tem um único plano, a guia já
  // vai para o prontuário. Sem paciente (ou com mais de um plano) ela fica
  // guardada no contato e a conferência do cadastro a grava com os demais dados.
  let authorizationId = draft.authorization_id;
  let note: string | undefined;
  if (draft.patient_id) {
    const { data: plans } = await supabase
      .from("patient_insurance")
      .select("id")
      .eq("patient_id", draft.patient_id)
      .eq("is_private", false);

    if (plans && plans.length === 1) {
      const row = {
        guide_number: guideNumber,
        procedure_code: procedureCode,
        sessions_authorized: sessions,
        valid_from: input.validFrom,
        valid_to: input.validTo,
        authorization_password: password,
        password_valid_until: passwordValidUntil,
        status: "ativa",
        approved_at: new Date().toISOString(),
      };
      if (authorizationId) {
        const { error } = await supabase.from("authorizations").update(row).eq("id", authorizationId);
        if (error) return { success: false, error: "Não foi possível atualizar a guia no prontuário." };
      } else {
        const { data: created, error } = await supabase
          .from("authorizations")
          .insert({ ...row, patient_insurance_id: plans[0].id })
          .select("id")
          .single();
        if (error || !created) return { success: false, error: "Não foi possível gravar a guia no prontuário." };
        authorizationId = created.id;
      }
    } else {
      note = "Guia guardada no contato — vincule o plano no prontuário para ela valer como guia ativa.";
    }
  }

  const { data: updated, error } = await supabase
    .from("registration_drafts")
    .update({
      plan_authorized_at: new Date().toISOString(),
      plan_authorized_by: user.id,
      authorization_waived: false,
      authorized_guide: guide,
      authorization_id: authorizationId,
    })
    .eq("id", draftId)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return { success: false, error: "Não foi possível registrar a autorização. Tente de novo." };
  }

  refresh();
  return { success: true, note };
}

/** Marca a etapa 2 como dispensada — particular, ou convênio que não exige guia para a 1ª avaliação. */
export async function waiveDraftAuthorization(draftId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: updated, error } = await supabase
    .from("registration_drafts")
    .update({
      authorization_waived: true,
      plan_authorized_at: null,
      plan_authorized_by: null,
      authorized_guide: null,
    })
    .eq("id", draftId)
    .is("authorization_id", null)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return { success: false, error: "Não foi possível dispensar a autorização — a guia já está no prontuário." };
  }

  refresh();
  return { success: true };
}

/** Volta a etapa 2 para "aguardando o plano" (marcou por engano, ou o plano voltou atrás). */
export async function undoDraftAuthorization(draftId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, authorization_id, scheduling_enabled_at")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };
  if (draft.scheduling_enabled_at) {
    return { success: false, error: "Retire a habilitação para agendamento antes de desfazer a autorização." };
  }
  if (draft.authorization_id) {
    return { success: false, error: "A guia já foi gravada no prontuário — ajuste ou cancele por lá." };
  }

  const { error } = await supabase
    .from("registration_drafts")
    .update({ plan_authorized_at: null, plan_authorized_by: null, authorization_waived: false, authorized_guide: null })
    .eq("id", draftId);
  if (error) return { success: false, error: "Não foi possível desfazer. Tente de novo." };

  refresh();
  return { success: true };
}

/**
 * Etapa 3: o "ok" para a Supervisão agendar a 1ª avaliação. Só depois da etapa 2
 * (autorizada ou dispensada) — agendar sem isso é o que gerava atendimento sem guia.
 */
export async function enableDraftScheduling(draftId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, plan_authorized_at, authorization_waived, patient_id")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };
  if (!draft.plan_authorized_at && !draft.authorization_waived) {
    return { success: false, error: "Registre a autorização do plano (ou dispense, se for particular) antes de habilitar." };
  }

  const { error } = await supabase
    .from("registration_drafts")
    .update({ scheduling_enabled_at: new Date().toISOString(), scheduling_enabled_by: user.id })
    .eq("id", draftId);
  if (error) return { success: false, error: "Não foi possível habilitar. Tente de novo." };

  refresh();
  return {
    success: true,
    note: draft.patient_id
      ? undefined
      : "Habilitado. Falta conferir o cadastro para o paciente aparecer na agenda da Supervisão.",
  };
}

/** Tira o "ok" de agendamento (habilitado por engano ou algo mudou no plano). */
export async function disableDraftScheduling(draftId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { error } = await supabase
    .from("registration_drafts")
    .update({ scheduling_enabled_at: null, scheduling_enabled_by: null })
    .eq("id", draftId);
  if (error) return { success: false, error: "Não foi possível retirar a habilitação. Tente de novo." };

  refresh();
  return { success: true };
}
