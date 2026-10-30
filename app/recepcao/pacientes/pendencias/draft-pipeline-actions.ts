// app/recepcao/pacientes/pendencias/draft-pipeline-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { extractText } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { promoteToPatient } from "@/lib/patient-stage";
import { parseAuthorizedGuideText, type GuideProcedure, type ParsedAuthorizedGuide } from "@/lib/authorized-guide-parser";
import { startEvaluationOffer } from "@/lib/evaluation-offer";

/**
 * Etapas 2, 3 e 4 da linha do tempo de cada contato da fila de pendências
 * (colunas de registration_drafts criadas em 20260921050000 e 20260922010000):
 *   2) guia enviada ao plano — processo manual fora do sistema (portal,
 *      e-mail, telefone); a clínica só marca aqui que já enviou;
 *   3) autorização junto ao plano — o plano respondeu, e a recepção marca
 *      aqui o resultado (guia autorizada, ou "particular / sem guia");
 *   4) habilitado para agendamento — o "ok" que a Agenda 1ª Avaliação da
 *      Supervisão exige antes de deixar marcar (lib/evaluation-agenda.ts).
 * Tudo com o client de sessão: a RLS de registration_drafts já restringe o
 * update a recepção/supervisor/gestor da clínica.
 */

type ActionResult =
  | {
      success: true;
      note?: string;
      /** Só em enableDraftScheduling: o que aconteceu com a oferta automática de horários por WhatsApp. */
      offer?: "sent" | "duplicate" | "failed";
    }
  | { success: false; error: string };

export type AuthorizedGuideInput = {
  guideNumber: string;
  /** Validade da senha = validade da guia (campo 6 da guia SP/SADT). */
  validTo: string;
  procedures: GuideProcedure[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_GUIDE_PDF_BYTES = 10 * 1024 * 1024;

/**
 * Lê a guia SP/SADT autorizada (PDF digital do plano) por algoritmo, sem IA, e
 * devolve os campos que o formulário da etapa 3 pré-preenche. Só leitura: nada
 * é gravado até a recepção confirmar.
 */
export async function parseAuthorizedGuidePdf(
  formData: FormData,
): Promise<{ success: true; guide: ParsedAuthorizedGuide } | { success: false; error: string }> {
  const { user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Escolha o PDF da guia autorizada." };
  if (file.size > MAX_GUIDE_PDF_BYTES) return { success: false, error: "O PDF passa de 10 MB." };
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { success: false, error: "Envie a guia em PDF." };
  }

  try {
    const { text } = await extractText(new Uint8Array(await file.arrayBuffer()));
    const fullText = Array.isArray(text) ? text.join("\n") : String(text ?? "");
    if (fullText.trim().length < 20) {
      return { success: false, error: "Esse PDF é imagem (sem texto). Preencha os campos à mão." };
    }
    return { success: true, guide: parseAuthorizedGuideText(fullText) };
  } catch {
    return { success: false, error: "Não consegui ler esse PDF. Preencha os campos à mão." };
  }
}

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

/** Marca a etapa 2 — a clínica enviou a guia de autorização ao plano (processo manual, fora do sistema). */
export async function markGuideSent(draftId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: updated, error } = await supabase
    .from("registration_drafts")
    .update({ guide_sent_at: new Date().toISOString(), guide_sent_by: user.id })
    .eq("id", draftId)
    .select("id");
  if (error || !updated || updated.length === 0) {
    return { success: false, error: "Não foi possível registrar o envio da guia. Tente de novo." };
  }

  refresh();
  return { success: true };
}

/** Desfaz a etapa 2 (marcou por engano) — só antes do plano responder. */
export async function undoGuideSent(draftId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, plan_authorized_at, authorization_waived")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };
  if (draft.plan_authorized_at || draft.authorization_waived) {
    return { success: false, error: "Desfaça a autorização do plano antes de desfazer o envio da guia." };
  }

  const { error } = await supabase
    .from("registration_drafts")
    .update({ guide_sent_at: null, guide_sent_by: null })
    .eq("id", draftId);
  if (error) return { success: false, error: "Não foi possível desfazer. Tente de novo." };

  refresh();
  return { success: true };
}

/** Marca a etapa 3 como concluída registrando a guia que o plano autorizou. */
export async function registerAuthorizedGuide(draftId: string, input: AuthorizedGuideInput): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  const validFrom = new Date().toLocaleDateString("en-CA", { timeZone: CLINIC_TIMEZONE });
  const guideNumber = input.guideNumber?.trim() || `AUT-${Date.now().toString().slice(-6)}`;
  let procedures = (input.procedures ?? [])
    .map((p) => ({ code: p.code.trim(), description: p.description.trim(), quantity: Math.trunc(Number(p.quantity)) }))
    .filter((p) => p.code || p.description);
  if (procedures.length === 0) {
    procedures = [{ code: "AVAL", description: "1ª Avaliação Global", quantity: 1 }];
  } else {
    procedures = procedures.map((p) => ({
      ...p,
      code: p.code || "AVAL",
      quantity: Number.isFinite(p.quantity) && p.quantity > 0 ? p.quantity : 1,
    }));
  }
  const validTo =
    input.validTo && ISO_DATE.test(input.validTo) && input.validTo >= validFrom
      ? input.validTo
      : new Date(Date.now() + 60 * 86_400_000).toLocaleDateString("en-CA", { timeZone: CLINIC_TIMEZONE });
  const totalSessions = procedures.reduce((sum, p) => sum + p.quantity, 0);

  const { data: draft } = await supabase
    .from("registration_drafts")
    .select("id, patient_id, authorization_id, scheduling_enabled_at, guide_sent_at")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { success: false, error: "Contato não encontrado." };
  if (draft.authorization_id) {
    return { success: false, error: "A guia já foi gravada no prontuário — ajuste ou cancele por lá." };
  }

  // `procedure_code` e `sessions_authorized` seguem preenchidos (primeiro código e
  // soma) para quem lê a guia como um item só; `procedures` é o detalhe por terapia.
  const guide = {
    guide_number: guideNumber,
    procedure_code: procedures[0].code,
    sessions_authorized: totalSessions,
    valid_from: validFrom,
    valid_to: input.validTo,
    authorization_password: null,
    password_valid_until: input.validTo,
    procedures,
  };

  // Se o cadastro já foi conferido e o paciente tem um único plano, a guia já
  // vai para o prontuário — uma linha de `authorizations` por procedimento, para
  // cada terapia ter o seu saldo de sessões. Sem paciente (ou com mais de um
  // plano) ela fica guardada no contato e a conferência do cadastro a grava.
  let authorizationId: string | null = null;
  let note: string | undefined;
  if (draft.patient_id) {
    const { data: plans } = await supabase
      .from("patient_insurance")
      .select("id")
      .eq("patient_id", draft.patient_id)
      .eq("is_private", false);

    if (plans && plans.length === 1) {
      const { data: created, error } = await supabase
        .from("authorizations")
        .insert(
          procedures.map((p) => ({
            patient_insurance_id: plans[0].id,
            guide_number: guideNumber,
            procedure_code: p.code,
            sessions_authorized: p.quantity,
            valid_from: validFrom,
            valid_to: input.validTo,
            password_valid_until: input.validTo,
            status: "ativa",
            approved_at: new Date().toISOString(),
          })),
        )
        .select("id");
      if (error || !created || created.length === 0) return { success: false, error: "Não foi possível gravar a guia no prontuário." };
      authorizationId = created[0].id;
    } else {
      note = "Guia guardada no contato — vincule o plano no prontuário para ela valer como guia ativa.";
    }
  }

  // A família pode ter mandado a guia já autorizada pelo plano sem passar pela
  // etapa 2 (o envio foi direto entre plano e responsável) — nesse caso a
  // etapa 2 é preenchida junto, para a trilha não ficar com um buraco.
  const { data: updated, error } = await supabase
    .from("registration_drafts")
    .update({
      ...(draft.guide_sent_at ? {} : { guide_sent_at: new Date().toISOString(), guide_sent_by: user.id }),
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

  await promoteToPatient(supabase, draft.patient_id);

  refresh();
  return { success: true, note };
}

/**
 * O contato tem plano de saúde identificado? Mesmas fontes da fila
 * (computeLeadPendencies): convênio no cadastro do paciente, plano da conversa
 * do WhatsApp, plano lido dos documentos ou resposta "tenho plano" no bot.
 */
async function draftHasPlan(supabase: Awaited<ReturnType<typeof createClient>>, draftId: string): Promise<boolean> {
  // `bot_collected` ainda não está nos tipos gerados (mesmo cast de lib/reception-queue.ts).
  const { data: draft } = await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("registration_drafts")
    .select("patient_id, source_phone, extracted, bot_collected")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return false;

  const bot = draft.bot_collected as { is_private?: unknown; card_number?: unknown } | null;
  if (bot?.is_private === false) return true;
  const filled = (v: unknown) => (typeof v === "string" ? v.trim() !== "" : v != null);
  if (filled(bot?.card_number)) return true;
  const insurance = (
    draft.extracted as { insurance?: { insurer_name?: unknown; insurer_id?: unknown; plan_name?: unknown; card_number?: unknown } } | null
  )?.insurance;
  if (filled(insurance?.insurer_name) || filled(insurance?.insurer_id) || filled(insurance?.plan_name) || filled(insurance?.card_number)) {
    return true;
  }

  const { data: cardFiles } = await supabase
    .from("registration_draft_files")
    .select("id")
    .eq("draft_id", draftId)
    .eq("detected_type", "carteirinha")
    .limit(1);
  if (cardFiles && cardFiles.length > 0) return true;

  // Contato ainda sem paciente vinculado: acha o paciente pelo telefone do responsável (formatos
  // diferentes: "(91) 9263-5677" × "+559192635677", então compara os 8 últimos dígitos).
  // Sem isso o contato do Théo foi dispensado como particular tendo PROASA no cadastro.
  const patientIds = new Set<string>();
  if (draft.patient_id) patientIds.add(draft.patient_id);
  const phoneTail = typeof draft.source_phone === "string" ? draft.source_phone.replace(/\D/g, "").slice(-8) : "";
  if (!draft.patient_id && phoneTail.length === 8) {
    const { data: guardians } = await supabase.from("guardians").select("patient_id, phone").not("phone", "is", null).limit(5000);
    for (const g of guardians ?? []) {
      if (g.patient_id && (g.phone ?? "").replace(/\D/g, "").slice(-8) === phoneTail) patientIds.add(g.patient_id);
    }
  }
  if (patientIds.size > 0) {
    const { data } = await supabase
      .from("patient_insurance")
      .select("id")
      .in("patient_id", [...patientIds])
      .eq("is_private", false)
      .not("insurer_id", "is", null)
      .limit(1);
    if (data && data.length > 0) return true;
  }
  if (draft.source_phone) {
    const { data } = await supabase
      .from("twilio_conversations")
      .select("id")
      .eq("phone_number", draft.source_phone)
      .not("insurer_id", "is", null)
      .limit(1);
    if (data && data.length > 0) return true;
  }
  return false;
}

/** Marca a etapa 3 como dispensada — particular. Contato com plano identificado não pode ser dispensado: segue a guia do plano. */
export async function waiveDraftAuthorization(draftId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { success: false, error: "Sessão expirada. Faça login de novo." };

  if (await draftHasPlan(supabase, draftId)) {
    return {
      success: false,
      error: "Este contato tem plano de saúde — não pode ser tratado como particular. Registre a autorização do plano (“Plano autorizou”).",
    };
  }

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

  // Particular / convênio sem guia: também está apto à 1ª avaliação.
  const { data: waivedDraft } = await supabase.from("registration_drafts").select("patient_id").eq("id", draftId).maybeSingle();
  await promoteToPatient(supabase, waivedDraft?.patient_id);

  refresh();
  return { success: true };
}

/** Volta a etapa 3 para "aguardando o plano" (marcou por engano, ou o plano voltou atrás). Mantém a guia como enviada (etapa 2). */
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
 * Etapa 4: o "ok" para a Supervisão agendar a 1ª avaliação. Só depois da etapa 3
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
  // Dispensa antiga de contato que depois ganhou plano: não vale como particular.
  if (!draft.plan_authorized_at && (await draftHasPlan(supabase, draftId))) {
    return { success: false, error: "Este contato tem plano de saúde — registre a autorização do plano (“Plano autorizou”) antes de habilitar." };
  }

  const { error } = await supabase
    .from("registration_drafts")
    .update({
      scheduling_enabled_at: new Date().toISOString(),
      scheduling_enabled_by: user.id,
      returned_to_reception_at: null,
      returned_to_reception_by: null,
      returned_to_reception_reason: null,
    })
    .eq("id", draftId);
  if (error) return { success: false, error: "Não foi possível habilitar. Tente de novo." };

  // Plano autorizou ou particular (dispensada): o bot do WhatsApp oferece 3 horários
  // ao responsável e a Supervisão confirma na Agenda 1ª Avaliação
  // (lib/evaluation-offer.ts). Falha aqui NÃO desfaz a habilitação — a
  // recepção ainda pode avisar a família pelo botão de WhatsApp manual.
  let offer: "sent" | "duplicate" | "failed" | undefined;
  let offerNote: string | undefined;
  if ((draft.plan_authorized_at || draft.authorization_waived) && draft.patient_id) {
    try {
      const started = await startEvaluationOffer({ patientId: draft.patient_id, draftId });
      if (started.status === "sent") {
        offer = "sent";
        offerNote = "Mensagem enviada ao responsável pelo WhatsApp com as opções de horário da 1ª avaliação.";
      } else if (started.status === "duplicate") {
        offer = "duplicate";
        offerNote = "A oferta de horários por WhatsApp já estava em andamento para este paciente.";
      } else {
        offer = "failed";
        offerNote = `Não foi possível enviar a oferta de horários automaticamente (${started.error}) Avise a família pelo botão de WhatsApp.`;
      }
    } catch (err) {
      console.error("[enableDraftScheduling] oferta de horários:", err);
      offer = "failed";
      offerNote = "Não foi possível enviar a oferta de horários automaticamente. Avise a família pelo botão de WhatsApp.";
    }
  }

  refresh();
  return {
    success: true,
    offer,
    note: draft.patient_id
      ? offerNote
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
