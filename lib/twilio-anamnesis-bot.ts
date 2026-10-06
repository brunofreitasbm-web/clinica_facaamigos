import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone } from "@/lib/twilio";
import { runAfterResponse } from "@/lib/after-response";
import { enrichLeadFromDocuments, registerLeadMedia, upsertWhatsappLead } from "@/lib/whatsapp-lead";
import { normalizeEmail, normalizeFullName, type LeadDocKind } from "@/lib/whatsapp-lead-pure";
import {
  MAX_TEXT_REPLIES_FOR_DOCUMENT,
  canonicalAnamnesisStep,
  isAgendarIntent,
  isNoDocumentAnswer,
  parseExitCommand,
  parseFullNameAnswer,
  parsePlanAnswer,
  parseYesNo,
  type PlanOption,
} from "@/lib/anamnesis-bot-pure";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { registerBotDraftFiles, syncBotDraft } from "@/lib/registration-drafts-bot";
import {
  PARTIAL_UNSUPPORTED_NOTE,
  RETRY_MEDIA_REPLY,
  UNSUPPORTED_MEDIA_REPLY,
  buildStoragePointer,
  collectMediaItems,
  splitCardPointers,
  summarizeMediaSave,
  type MediaItem,
} from "@/lib/whatsapp-media-pure";

export interface TwilioIncomingParams {
  from: string;
  body: string;
  mediaUrl0?: string;
  mediaContentType0?: string;
  /** Todos os anexos da mensagem; sem ele vale só `mediaUrl0`. */
  media?: MediaItem[];
  /** Conversa da Central de Atendimento (grava o plano identificado). */
  conversationId?: string | null;
}

/** `escalate`: o lead pediu ATENDENTE — o roteador (lib/twilio.ts) passa a conversa para a equipe. */
export type AnamnesisStepResult = { handled: boolean; replyMessage: string; escalate?: boolean };

/**
 * Remove acentos e padroniza texto para comparação de intenções.
 */
function normalizeText(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Formata CPF simples para validação visual.
 */
function cleanCPF(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Converte data no formato DD/MM/AAAA (como as famílias digitam no WhatsApp)
 * para AAAA-MM-DD (formato aceito pela coluna `date` do Postgres). Retorna
 * null se o texto não for uma data válida.
 */
function parseBrazilianDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isValid || date > new Date()) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Grava a etapa e os dados coletados na sessão do bot e espelha no rascunho da
 * fila de Pendências da recepção (lib/registration-drafts-bot.ts) — é o que faz
 * todo lead que já deu algum dado aparecer lá, mesmo se abandonar o fluxo.
 */
async function persistStep(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  phone: string,
  step: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
): Promise<void> {
  await supabase
    .from("chatbot_sessions")
    .update({
      current_step: step,
      collected_data: data,
      updated_at: new Date().toISOString(),
    })
    .eq("phone_number", phone);
  await syncBotDraft({ phone, data, step });
}

/**
 * Guarda TODOS os anexos da mensagem da etapa de mídia como documentos do
 * lead (bucket privado `clinic-documents`, via lib/whatsapp-lead.ts) e devolve
 * os ponteiros `storage://clinic-documents/<path>` no lugar da URL do arquivo
 * — nunca a URL crua do Twilio (exige autenticação e some). Sem nenhum arquivo
 * salvo NÃO se avança de etapa: `reply` pede o reenvio. O lead nasce (ou é
 * reaproveitado) aqui, com o nome/nascimento já coletados; o id fica em
 * `data.lead_patient_id` para a requisição não duplicar o paciente.
 */
async function saveStepMedia(
  params: TwilioIncomingParams,
  phone: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  kind: LeadDocKind,
  missingReply: string,
): Promise<{ ok: true; pointers: string[]; note: string } | { ok: false; reply: string }> {
  const media = collectMediaItems(params);
  if (media.length === 0) return { ok: false, reply: missingReply };

  const result = await registerLeadMedia({
    identity: {
      phone,
      childName: data.child_name,
      childBirthDate: data.child_birth_date,
      guardianName: data.guardian_name,
      guardianCpf: data.guardian_cpf,
      guardianEmail: data.guardian_email,
    },
    media,
    kind,
  });

  const summary = summarizeMediaSave(result);
  if (summary.status === "unsupported") return { ok: false, reply: UNSUPPORTED_MEDIA_REPLY };
  if (summary.status === "retry") return { ok: false, reply: RETRY_MEDIA_REPLY };

  // Reentrega do Twilio (mesma MediaUrl) de um arquivo de etapa ANTERIOR: o
  // registro de mídia devolve o documento já salvo (duplicata), e sem esta
  // guarda a Guia reentregue viraria a "frente da carteirinha". Ponteiro já
  // gravado em `data` = replay; a resposta da primeira entrega já saiu, então
  // silêncio e nenhuma mudança de etapa. (Se a primeira entrega caiu ANTES de
  // gravar a etapa, o ponteiro ainda não está em `data` e o fluxo avança.)
  const knownPointers = new Set(
    [
      data.laudo_pdf_url,
      data.guia_pdf_url,
      data.carteirinha_frente_url,
      data.carteirinha_verso_url,
      data.documento_identidade_url,
    ].filter(Boolean),
  );
  if (summary.pointers.some((p) => knownPointers.has(p))) return { ok: false, reply: "" };

  const patientId = result.patientId;
  if (patientId) {
    data.lead_patient_id = patientId;
    // Anexa os documentos ao rascunho da fila de Pendências (a recepção vê os
    // arquivos e a pílula acende sem abrir a conversa).
    await registerBotDraftFiles({ phone, documentIds: result.documentIds });
    if (result.saved > 0 || result.adopted > 0) {
      // IA completa o cadastro do lead em segundo plano (só campos em branco).
      runAfterResponse("enriquecer lead (anamnese)", () => enrichLeadFromDocuments(patientId));
    }
  }
  return { ok: true, pointers: summary.pointers, note: summary.unsupportedNote ? PARTIAL_UNSUPPORTED_NOTE : "" };
}

/**
 * Pede o Documento de Identidade (RG ou CNH) do responsável. Junto com a
 * carteirinha é o que permite a recepção validar a elegibilidade junto ao
 * plano — e de onde a IA tira o CPF, que deixou de ser digitado.
 */
async function askDocumentoIdentidade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  phone: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  intro: string,
): Promise<AnamnesisStepResult> {
  data.rg_requested_at = new Date().toISOString();
  await persistStep(supabase, phone, "awaiting_documento_identidade", data);

  return {
    handled: true,
    replyMessage: `${intro}\n\nPor último, envie uma foto do *RG ou CNH do responsável*. 📄`,
  };
}

/**
 * Número do cartão: a IA lê da carteirinha (enrichLeadFromDocuments grava em
 * `patient_insurance`). Só quando a leitura não achou é que perguntamos —
 * mesmo padrão do bot de convênio (lib/twilio-intake-bot.ts).
 */
async function finishOrAskCardNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  phone: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  intro: string,
): Promise<AnamnesisStepResult> {
  if (!data.card_number && data.lead_patient_id) {
    const { data: insurance } = await supabase
      .from("patient_insurance")
      .select("card_number")
      .eq("patient_id", data.lead_patient_id)
      .not("card_number", "is", null)
      .limit(1)
      .maybeSingle();
    if (insurance?.card_number) data.card_number = insurance.card_number;
  }
  if (data.card_number) {
    const done = await finalizeAnamnesisRequest(supabase, phone, data);
    return { ...done, replyMessage: intro ? `${intro}\n\n${done.replyMessage}` : done.replyMessage };
  }

  await persistStep(supabase, phone, "awaiting_card_number", data);
  return {
    handled: true,
    replyMessage: `${intro ? `${intro}\n\n` : ""}Não consegui ler o número na carteirinha. Digite o *número do cartão* do plano:`,
  };
}

/**
 * Documento do lead que chegou por fora da etapa (ex.: a foto do RG que a
 * ingestão "a frio" guardou antes desta correção) e ainda não está em `data`.
 */
async function findUnclaimedLeadDocument(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
): Promise<string | null> {
  if (!data.lead_patient_id) return null;
  const known = new Set(
    [data.laudo_pdf_url, data.guia_pdf_url, data.carteirinha_frente_url, data.carteirinha_verso_url].filter(Boolean),
  );
  let query = supabase
    .from("documents")
    .select("storage_path, uploaded_at")
    .eq("patient_id", data.lead_patient_id)
    .eq("source", "whatsapp")
    .order("uploaded_at", { ascending: false })
    .limit(10);
  if (data.rg_requested_at) query = query.gte("uploaded_at", data.rg_requested_at);
  const { data: docs } = await query;
  for (const doc of (docs ?? []) as { storage_path: string }[]) {
    const pointer = buildStoragePointer(doc.storage_path);
    if (!known.has(pointer)) return pointer;
  }
  return null;
}

/**
 * Mensagem única enviada ao lead de convênio após receber documentos e
 * informações. O prazo de 7 dias é o da devolutiva da autorização do plano.
 */
const CONVENIO_DOCS_RECEIVED_MESSAGE =
  "Tudo certo! 🎉 Recebemos os documentos. A supervisão vai conferir e pedir a autorização ao plano.\n\n" +
  "Em até *7 dias* te damos o retorno por aqui para marcarmos a avaliação. 💙";

const PENDING_STATUS_MESSAGE =
  "Sua solicitação está em análise pela supervisão. 💙 Assim que for validada, enviamos os horários por aqui. " +
  "Se tiver alguma dúvida, é só escrever.";

/**
 * Insere a requisição na fila de aprovação do supervisor com Laudo, Carteirinha
 * e número do cartão (e a Guia, quando o responsável já a tem — é opcional:
 * sem ela, a clínica autoriza), e coloca a sessão em `pending_supervisor`.
 */
async function finalizeAnamnesisRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  phone: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
): Promise<AnamnesisStepResult> {
  // Paciente-lead já criado a partir dos documentos (ou o do telefone/criança):
  // a requisição precisa carregá-lo, senão `book_anamnesis_slot_atomic` cria um
  // paciente NOVO quando `patient_id` é nulo e o lead fica duplicado.
  let leadPatientId: string | null = data.lead_patient_id ?? null;
  if (!leadPatientId) {
    const lead = await upsertWhatsappLead({
      phone,
      childName: data.child_name,
      childBirthDate: data.child_birth_date,
      guardianName: data.guardian_name,
      guardianCpf: data.guardian_cpf,
      guardianEmail: data.guardian_email,
    });
    leadPatientId = lead?.patientId ?? null;
    if (leadPatientId) data.lead_patient_id = leadPatientId;
  }

  // CPF não é mais digitado: vem do RG/CNH lido pela IA (guardians.cpf). A
  // coluna é NOT NULL, então sem leitura vai vazio e a recepção completa.
  if (!data.guardian_cpf && leadPatientId) {
    const { data: guardian } = await supabase
      .from("guardians")
      .select("cpf")
      .eq("patient_id", leadPatientId)
      .not("cpf", "is", null)
      .limit(1)
      .maybeSingle();
    if (guardian?.cpf) data.guardian_cpf = guardian.cpf;
  }

  const { data: reqData, error: reqErr } = await supabase
    .from("anamnesis_scheduling_requests")
    .insert({
      guardian_name: data.guardian_name,
      guardian_phone: phone,
      guardian_cpf: data.guardian_cpf ?? "",
      child_name: data.child_name,
      child_birth_date: data.child_birth_date,
      laudo_pdf_url: data.laudo_pdf_url,
      guia_pdf_url: data.guia_pdf_url,
      carteirinha_frente_url: data.carteirinha_frente_url,
      carteirinha_verso_url: data.carteirinha_verso_url,
      card_number: data.card_number,
      is_private: data.is_private === true,
      patient_id: leadPatientId,
      status: "pendente_supervisor",
    })
    .select("id")
    .single();

  if (reqErr || !reqData) {
    // Os documentos e o lead já estão salvos (a supervisão os enxerga no painel
    // de leads), então não fingimos que a solicitação entrou na fila de
    // validação: avisamos que a equipe entra em contato e liberamos a sessão.
    console.error("[Anamnesis Request Insert Error]:", reqErr?.message);
    // A sessão é zerada logo abaixo: antes disso o rascunho da fila de
    // Pendências guarda o que o responsável já informou.
    await syncBotDraft({ phone, data, step: "pending_supervisor" });
    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "idle",
        collected_data: {},
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

    return {
      handled: true,
      replyMessage:
        "Recebemos os seus documentos e informações! 💙 Tivemos um contratempo para concluir o pedido de agendamento por aqui, " +
        "mas a nossa equipe já tem tudo em mãos e entrará em contato em breve para seguir com a avaliação.",
    };
  }

  data.request_id = reqData.id;

  await persistStep(supabase, phone, "pending_supervisor", data);

  if (data.is_private === true) {
    return {
      handled: true,
      replyMessage:
        "Tudo certo! 🎉 Recebemos o pedido de avaliação *particular*. " +
        "Assim que a supervisão validar, enviamos os horários por aqui para você escolher. 🧩💙",
    };
  }

  return { handled: true, replyMessage: CONVENIO_DOCS_RECEIVED_MESSAGE };
}

/** Etapas desta máquina (já canônicas — ver `canonicalAnamnesisStep`). */
const OWN_STEPS = new Set([
  "awaiting_guardian_name",
  "legacy_identity",
  "awaiting_child_name",
  "awaiting_child_birth_date",
  "awaiting_plan",
  "awaiting_laudo",
  "awaiting_carteirinha",
  "awaiting_carteirinha_verso",
  "awaiting_documento_identidade",
  "awaiting_card_number",
  "pending_supervisor",
  "awaiting_slot_selection",
]);

/** Etapas em que o lead ainda está respondendo (PARAR zera; depois delas a requisição já existe). */
const AFTER_SUBMISSION_STEPS = new Set(["pending_supervisor", "awaiting_slot_selection"]);

const HUMAN_HANDOFF_REPLY = "Certo! 💙 Chamei a nossa equipe, que continua o atendimento por aqui em horário comercial.";

const CHILD_NAME_QUESTION = "Qual o *nome completo da criança ou adolescente* que fará a avaliação?";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadActiveInsurers(supabase: any): Promise<PlanOption[]> {
  const { data } = await supabase
    .from("insurers")
    .select("id, name")
    .eq("clinic_id", DEV_CLINIC_ID)
    .eq("active", true)
    .order("name");
  return ((data ?? []) as PlanOption[]).filter((i) => normalizeText(i.name) !== "particular");
}

function insurerList(insurers: PlanOption[]): string {
  return insurers.length > 0 ? insurers.map((i) => `*${i.name}*`).join(", ") : "nossos convênios parceiros";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resetSession(supabase: any, phone: string): Promise<void> {
  await supabase
    .from("chatbot_sessions")
    .update({ current_step: "idle", collected_data: {}, updated_at: new Date().toISOString() })
    .eq("phone_number", phone);
}

/**
 * Processador principal da máquina de estados de agendamento de Anamnese via WhatsApp.
 *
 * Fluxo enxuto (auditoria out/2026): nome do responsável → criança → nascimento
 * → qual plano → laudo → carteirinha → RG/CNH. CPF, e-mail e número do cartão
 * deixaram de ser digitados: a IA lê dos documentos (enrichLeadFromDocuments) e
 * o número só é perguntado se a leitura não achar. PARAR/ATENDENTE funcionam em
 * qualquer etapa.
 */
export async function processAnamnesisChatbotStep(params: TwilioIncomingParams): Promise<AnamnesisStepResult> {
  const phone = formatE164Phone(params.from);
  const rawBody = params.body || "";
  const hasMedia = collectMediaItems(params).length > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // 1. Buscar ou inicializar sessão do usuário
  let { data: session } = await supabase
    .from("chatbot_sessions")
    .select("*")
    .eq("phone_number", phone)
    .single();

  if (!session) {
    const { data: newSession } = await supabase
      .from("chatbot_sessions")
      .insert({
        phone_number: phone,
        current_step: "idle",
        collected_data: {},
      })
      .select("*")
      .single();

    session = newSession;
  }

  const storedStep: string = session?.current_step || "idle";
  const currentStep = canonicalAnamnesisStep(storedStep);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (session?.collected_data as Record<string, any>) || {};

  // 2. Início do fluxo. `completed` (avaliação já marcada) também aceita um
  // novo AGENDAR — antes ficava preso e o FAQ mandava responder AGENDAR em loop.
  if (currentStep === "idle" || currentStep === "completed") {
    // ATENDENTE fora do fluxo também chama a equipe sem depender da IA (o
    // Gemini falha em ~12% das chamadas e o pedido caía no fallback).
    if (parseExitCommand(rawBody) === "human") {
      return { handled: true, escalate: true, replyMessage: HUMAN_HANDOFF_REPLY };
    }
    if (!isAgendarIntent(rawBody)) return { handled: false, replyMessage: "" };

    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_guardian_name",
        collected_data: { started_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

    // Sem "Olá/Boas-vindas": quem digita AGENDAR já recebeu a saudação.
    return {
      handled: true,
      replyMessage:
        "Vamos agendar a avaliação! 🧩\n\n" +
        "Qual o seu *nome completo* (responsável)?\n\n" +
        "_Para falar com a equipe a qualquer momento, responda ATENDENTE._",
    };
  }

  // Etapas de outros bots (pré-anamnese, faltas, convênio) não são daqui.
  if (!OWN_STEPS.has(currentStep)) return { handled: false, replyMessage: "" };

  // 3. Saída do fluxo em qualquer etapa.
  const exit = parseExitCommand(rawBody);
  const collecting = !AFTER_SUBMISSION_STEPS.has(currentStep);
  if (exit === "human") {
    if (collecting) {
      await syncBotDraft({ phone, data, step: storedStep });
      await resetSession(supabase, phone);
    }
    return {
      handled: true,
      escalate: true,
      replyMessage: HUMAN_HANDOFF_REPLY,
    };
  }
  if (exit === "stop" && collecting) {
    await syncBotDraft({ phone, data, step: storedStep });
    await resetSession(supabase, phone);
    return {
      handled: true,
      replyMessage: "Tudo bem, paramos por aqui. 💙 Quando quiser retomar, é só responder *AGENDAR*.",
    };
  }

  // 4. Nome do responsável (nome completo, com sobrenome — sem isso o
  // lead/responsável não pode ser criado).
  if (currentStep === "awaiting_guardian_name") {
    const guardianName = parseFullNameAnswer(rawBody, normalizeFullName);
    if (!guardianName) {
      return { handled: true, replyMessage: "Preciso do seu nome completo, com sobrenome:" };
    }

    data.guardian_name = guardianName;
    await persistStep(supabase, phone, "awaiting_child_name", data);
    return { handled: true, replyMessage: `Obrigado, *${guardianName}*! 💙\n\n${CHILD_NAME_QUESTION}` };
  }

  // 4b. Quem parou no fluxo antigo respondendo CPF ou e-mail: aproveita a
  // resposta se vier válida e segue (esses dados agora vêm dos documentos).
  if (currentStep === "legacy_identity") {
    if (storedStep === "awaiting_guardian_cpf" && cleanCPF(rawBody).length === 11) data.guardian_cpf = cleanCPF(rawBody);
    if (storedStep === "awaiting_guardian_email") {
      const email = normalizeEmail(rawBody);
      if (email) data.guardian_email = email;
    }
    delete data.guardian_email_asked_again;
    await persistStep(supabase, phone, "awaiting_child_name", data);
    return { handled: true, replyMessage: `Anotado! ✅\n\n${CHILD_NAME_QUESTION}` };
  }

  // 5. Nome da criança/adolescente (nome completo)
  if (currentStep === "awaiting_child_name") {
    const childName = parseFullNameAnswer(rawBody, normalizeFullName);
    if (!childName) {
      return {
        handled: true,
        replyMessage: "Preciso do nome completo da criança ou adolescente, com sobrenome:",
      };
    }

    data.child_name = childName;
    await persistStep(supabase, phone, "awaiting_child_birth_date", data);
    return { handled: true, replyMessage: `Qual a *data de nascimento* de ${childName}? (DD/MM/AAAA)` };
  }

  // 5b. Data de nascimento
  if (currentStep === "awaiting_child_birth_date") {
    const isoDate = parseBrazilianDate(rawBody);
    if (!isoDate) {
      return { handled: true, replyMessage: "Data inválida. Informe no formato DD/MM/AAAA (ex: 15/03/2018):" };
    }

    data.child_birth_date = isoDate;
    await persistStep(supabase, phone, "awaiting_plan", data);
    const insurers = await loadActiveInsurers(supabase);
    return {
      handled: true,
      replyMessage:
        "Anotado! 🧩 O atendimento será por qual *plano de saúde*?\n\n" +
        `Responda o nome do plano (atendemos ${insurerList(insurers)}) ou *PARTICULAR*.`,
    };
  }

  // 5c. Qual plano. Antes era só "CONVÊNIO ou PARTICULAR": o plano nunca era
  // perguntado e quem tinha um plano não atendido mandava todos os documentos
  // à toa. Particular não tem laudo, carteirinha nem número de cartão.
  if (currentStep === "awaiting_plan") {
    const insurers = await loadActiveInsurers(supabase);
    const answer = parsePlanAnswer(rawBody, insurers);

    if (answer.kind === "particular") {
      data.is_private = true;
      return finalizeAnamnesisRequest(supabase, phone, data);
    }

    if (answer.kind === "insurer") {
      data.is_private = false;
      data.insurer_id = answer.id;
      data.insurer_name = answer.name;
      if (params.conversationId) {
        await supabase.from("twilio_conversations").update({ insurer_id: answer.id }).eq("id", params.conversationId);
      }
      await persistStep(supabase, phone, "awaiting_laudo", data);
      return {
        handled: true,
        replyMessage:
          `Perfeito, atendemos *${answer.name}*! 💙\n\n` +
          `Envie a foto ou PDF do *laudo* (ou pedido médico com CID) de ${data.child_name}. ` +
          "Se ainda não tiver, responda *NÃO TENHO*.",
      };
    }

    if (answer.kind === "not_served") {
      return {
        handled: true,
        replyMessage:
          `No momento não atendemos *${answer.typed}* pelo convênio — atendemos ${insurerList(insurers)}. 💙\n\n` +
          "Se quiser seguir pelo particular, responda *PARTICULAR*. Para falar com a equipe, responda *ATENDENTE*.",
      };
    }

    return {
      handled: true,
      replyMessage: `Qual o nome do plano? Atendemos ${insurerList(insurers)}. Ou responda *PARTICULAR*.`,
    };
  }

  // 6. Laudo: um passo só (antes: "tem laudo? SIM/NÃO" + "envie o laudo").
  if (currentStep === "awaiting_laudo") {
    if (hasMedia) {
      const saved = await saveStepMedia(
        params,
        phone,
        data,
        "laudo",
        "Não consegui abrir o arquivo. Envie a foto ou PDF do laudo novamente.",
      );
      if (!saved.ok) return { handled: true, replyMessage: saved.reply };

      data.laudo_pdf_url = saved.pointers[0];
      data.has_laudo = true;
      await persistStep(supabase, phone, "awaiting_carteirinha", data);
      return {
        handled: true,
        replyMessage:
          "Laudo recebido! ✅\n\n" +
          "Agora envie a *carteirinha do plano* — frente e verso (2 fotos) ou um PDF. " +
          "A guia autorizada não é obrigatória: se não tiver, a clínica pede a autorização." +
          saved.note,
      };
    }

    if (isNoDocumentAnswer(rawBody)) {
      // A sessão é zerada, mas o rascunho da fila de Pendências guarda tudo (e
      // o "não tenho laudo") para a recepção acompanhar.
      data.has_laudo = false;
      await syncBotDraft({ phone, data, step: storedStep });
      await resetSession(supabase, phone);
      return {
        handled: true,
        replyMessage:
          "Entendido! 💙 Pelo plano, precisamos do *laudo* ou *pedido médico* (com CID) para pedir a autorização.\n\n" +
          "Quando tiver o documento, é só responder *AGENDAR* por aqui.",
      };
    }

    if (parseYesNo(rawBody) === "yes") {
      return { handled: true, replyMessage: "Ótimo! 📄 Envie a foto ou PDF do *laudo* por aqui." };
    }

    return {
      handled: true,
      replyMessage: "Para seguir, envie a *foto ou PDF do laudo* (ou responda *NÃO TENHO*).",
    };
  }

  // 7. Carteirinha (frente e verso numa mensagem só, ou PDF). Quem parou na
  // etapa antiga da guia ainda pode mandá-la: entra como guia e seguimos.
  if (currentStep === "awaiting_carteirinha") {
    if (!hasMedia) {
      return {
        handled: true,
        replyMessage: "Envie a foto da *carteirinha do plano* (frente e verso) ou um PDF com as duas páginas.",
      };
    }

    if (storedStep === "awaiting_guia_pdf") {
      const savedGuia = await saveStepMedia(params, phone, data, "guia", "Não consegui abrir o arquivo. Envie a guia novamente.");
      if (!savedGuia.ok) return { handled: true, replyMessage: savedGuia.reply };
      data.guia_pdf_url = savedGuia.pointers[0];
      await persistStep(supabase, phone, "awaiting_carteirinha", data);
      return {
        handled: true,
        replyMessage: `Guia recebida! ✅\n\nAgora envie a *carteirinha do plano* — frente e verso (2 fotos) ou um PDF.${savedGuia.note}`,
      };
    }

    const saved = await saveStepMedia(
      params,
      phone,
      data,
      "carteirinha",
      "Não consegui abrir o arquivo. Envie a foto ou PDF da carteirinha novamente.",
    );
    if (!saved.ok) return { handled: true, replyMessage: saved.reply };

    // PDF único cobre frente e verso, e duas fotos na mesma mensagem já são
    // frente+verso — nesses casos não precisa pedir a segunda foto.
    const { front, back } = splitCardPointers(saved.pointers);
    data.carteirinha_frente_url = front;
    if (back) {
      data.carteirinha_verso_url = back;
      return askDocumentoIdentidade(supabase, phone, data, `Carteirinha recebida! ✅${saved.note}`);
    }

    await persistStep(supabase, phone, "awaiting_carteirinha_verso", data);
    return {
      handled: true,
      replyMessage: `Frente recebida! ✅ Agora envie o *verso* da carteirinha.${saved.note}`,
    };
  }

  // 7b. Verso da carteirinha (dispensável: "não tenho" segue só com a frente)
  if (currentStep === "awaiting_carteirinha_verso") {
    if (!hasMedia) {
      if (isNoDocumentAnswer(rawBody)) {
        return askDocumentoIdentidade(supabase, phone, data, "Tudo bem, seguimos só com a frente. 👍");
      }
      return { handled: true, replyMessage: "Envie a foto do *verso* da carteirinha (ou responda *NÃO TENHO*)." };
    }

    const saved = await saveStepMedia(
      params,
      phone,
      data,
      "carteirinha",
      "Não consegui abrir o arquivo. Envie a foto do verso da carteirinha novamente.",
    );
    if (!saved.ok) return { handled: true, replyMessage: saved.reply };

    data.carteirinha_verso_url = saved.pointers[0];
    return askDocumentoIdentidade(supabase, phone, data, `Verso recebido! ✅${saved.note}`);
  }

  // 8. RG/CNH do responsável. Era o maior ponto de abandono: a foto caía na
  // ingestão "a frio" (a etapa não estava em ANAMNESIS_AWAITING_ATTACHMENT_STEPS
  // de lib/twilio.ts) e todo texto seguinte recebia "Arquivo não identificado"
  // em loop. Agora: aproveita o documento que já chegou, aceita "envio depois"
  // e, na segunda resposta em texto, segue sem o RG (a recepção pede depois).
  if (currentStep === "awaiting_documento_identidade") {
    if (hasMedia) {
      const saved = await saveStepMedia(
        params,
        phone,
        data,
        "documento_identidade",
        "Não consegui abrir o arquivo. Envie a foto do RG ou CNH novamente.",
      );
      if (!saved.ok) return { handled: true, replyMessage: saved.reply };

      data.documento_identidade_url = saved.pointers[0];
      return finishOrAskCardNumber(supabase, phone, data, `Documento recebido! ✅${saved.note}`);
    }

    const alreadySent = await findUnclaimedLeadDocument(supabase, data);
    if (alreadySent) {
      data.documento_identidade_url = alreadySent;
      return finishOrAskCardNumber(supabase, phone, data, "Já recebemos o seu documento. ✅");
    }

    const attempts = Number(data.rg_text_replies ?? 0) + 1;
    if (isNoDocumentAnswer(rawBody) || attempts >= MAX_TEXT_REPLIES_FOR_DOCUMENT) {
      delete data.rg_text_replies;
      data.rg_pending = true;
      return finishOrAskCardNumber(supabase, phone, data, "Sem problema — a recepção pede o documento depois. 👍");
    }

    data.rg_text_replies = attempts;
    await persistStep(supabase, phone, "awaiting_documento_identidade", data);
    return {
      handled: true,
      replyMessage:
        "Preciso de uma *foto* do RG ou CNH do responsável. Se não estiver com ele agora, responda *ENVIO DEPOIS*.",
    };
  }

  // 9. Número do cartão — só chega aqui quando a IA não leu da carteirinha.
  if (currentStep === "awaiting_card_number") {
    // Só o número importa: aceita "0 123 456789 00-1" mas exige um mínimo de
    // caracteres alfanuméricos (carteirinhas variam de 8 a 20 dígitos/letras).
    const cardNumber = rawBody.replace(/[^A-Za-z0-9]/g, "");
    if (cardNumber.length < 6) {
      return {
        handled: true,
        replyMessage: "Não consegui identificar o número. Digite o *número do cartão* do plano, exatamente como está impresso:",
      };
    }

    data.card_number = cardNumber;
    return finalizeAnamnesisRequest(supabase, phone, data);
  }

  // 10. Aguardando aprovação do supervisor. Antes TODA mensagem recebia o
  // mesmo texto e o lead não conseguia perguntar nada: agora só AGENDAR/SIM/NÃO
  // e afins recebem o status; perguntas seguem para o agente de FAQ.
  if (currentStep === "pending_supervisor") {
    const short = normalizeText(rawBody).split(/\s+/).filter(Boolean).length <= 3;
    if (isAgendarIntent(rawBody) || parseYesNo(rawBody) !== null || (short && !hasMedia && !rawBody.includes("?"))) {
      return { handled: true, replyMessage: PENDING_STATUS_MESSAGE };
    }
    return { handled: false, replyMessage: "" };
  }

  // 11. Escolha do slot de horário pelo responsável (pós-aprovação do supervisor)
  if (currentStep === "awaiting_slot_selection") {
    const slots = (data.available_slots as Array<{ index: number; label: string; starts_at: string; ends_at: string; therapist_id: string; room_id: string }>) || [];

    const choiceNum = parseInt(rawBody.trim(), 10);
    const selectedSlot = slots.find((s) => s.index === choiceNum);

    if (!choiceNum || !selectedSlot) {
      return {
        handled: true,
        replyMessage: "Opção inválida. Digite apenas o *número* do horário desejado (ex: 1, 2...).",
      };
    }

    // Executar RPC de agendamento atômico no banco com Lock Otimista
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcErr } = await (supabase as any).rpc("book_anamnesis_slot_atomic", {
      p_request_id: data.request_id,
      p_therapist_id: selectedSlot.therapist_id,
      p_room_id: selectedSlot.room_id,
      p_starts_at: selectedSlot.starts_at,
      p_ends_at: selectedSlot.ends_at,
      p_discipline: "Avaliação Multifuncional / Anamnese",
    });

    const resObj = rpcResult as { success?: boolean; error?: string } | null;

    if (rpcErr || !resObj?.success) {
      const errReason = resObj?.error || rpcErr?.message || "Erro ao efetuar reserva.";

      return {
        handled: true,
        replyMessage: `⚠️ ${errReason}\n\nPor favor, escolha outro número de horário disponível.`,
      };
    }

    // Sessão concluída: `completed` aceita um novo AGENDAR (passo 2).
    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "completed",
        collected_data: { completed_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

    const formattedDate = new Date(selectedSlot.starts_at).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "full",
      timeStyle: "short",
    });

    return {
      handled: true,
      replyMessage:
        `✅ *AGENDAMENTO CONFIRMADO!*\n\n` +
        `👤 *Paciente:* ${data.child_name}\n` +
        `📅 *Data e Horário:* ${formattedDate}\n` +
        `📍 *Local:* FaçaAmigos - Sala de Anamnese\n\n` +
        "Aguardamos vocês! Traga os documentos originais no dia da consulta. 💙✨",
    };
  }

  return { handled: false, replyMessage: "" };
}
