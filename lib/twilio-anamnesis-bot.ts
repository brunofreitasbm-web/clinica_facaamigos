import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone } from "@/lib/twilio";
import { runAfterResponse } from "@/lib/after-response";
import { enrichLeadFromDocuments, registerLeadMedia, upsertWhatsappLead } from "@/lib/whatsapp-lead";
import { normalizeEmail, normalizeFullName, type LeadDocKind } from "@/lib/whatsapp-lead-pure";
import { decideGuardianEmailStep, parseFullNameAnswer } from "@/lib/anamnesis-bot-pure";
import { registerBotDraftFiles, syncBotDraft } from "@/lib/registration-drafts-bot";
import {
  PARTIAL_UNSUPPORTED_NOTE,
  RETRY_MEDIA_REPLY,
  UNSUPPORTED_MEDIA_REPLY,
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
}

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
    [data.laudo_pdf_url, data.guia_pdf_url, data.carteirinha_frente_url, data.carteirinha_verso_url].filter(Boolean),
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
 * Depois da carteirinha (fotos ou PDF único), pede o número do cartão — todo
 * atendimento por convênio precisa dele além da imagem, pro faturamento.
 */
async function askCardNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  phone: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  intro: string,
): Promise<{ handled: boolean; replyMessage: string }> {
  await persistStep(supabase, phone, "awaiting_card_number", data);

  return {
    handled: true,
    replyMessage: `${intro}\n\nPor último, digite o *número do cartão* (número da carteirinha) do plano:`,
  };
}

/**
 * Mensagem única enviada ao lead de convênio após receber documentos e
 * informações. O prazo de 7 dias é o da devolutiva da autorização do plano.
 */
const CONVENIO_DOCS_RECEIVED_MESSAGE =
  "Tudo certo! 🎉 A nossa supervisão recepcionou os documentos e as informações, irá analisá-los e iniciar o processo de autorização junto ao plano.\n\n" +
  "No prazo de até *7 dias*, daremos uma devolutiva (um retorno acerca do processo) para então agendarmos a avaliação. 💙";

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
): Promise<{ handled: boolean; replyMessage: string }> {
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

  const { data: reqData, error: reqErr } = await supabase
    .from("anamnesis_scheduling_requests")
    .insert({
      guardian_name: data.guardian_name,
      guardian_phone: phone,
      guardian_cpf: data.guardian_cpf,
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
        "Tudo certo! 🎉 Recebemos as informações do atendimento *particular*.\n\n" +
        "Nosso supervisor fará a validação rápida. Assim que aprovado, enviaremos os horários disponíveis por aqui para você escolher! 🧩💙",
    };
  }

  return { handled: true, replyMessage: CONVENIO_DOCS_RECEIVED_MESSAGE };
}

/**
 * Processador principal da máquina de estados de agendamento de Anamnese via WhatsApp.
 */
export async function processAnamnesisChatbotStep(
  params: TwilioIncomingParams
): Promise<{ handled: boolean; replyMessage: string }> {
  const phone = formatE164Phone(params.from);
  const rawBody = params.body || "";
  const normBody = normalizeText(rawBody);

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

  const currentStep = session?.current_step || "idle";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (session?.collected_data as Record<string, any>) || {};

  // 2. Detecção de Início do Fluxo de Agendamento/Anamnese se estiver em `idle`
  if (currentStep === "idle") {
    // Só intenção EXPLÍCITA de agendar entra na máquina de estados. A lista
    // antiga incluía "plano", "laudo", "guia", "consulta", "avaliacao" e
    // "triagem" — como este passo roda antes do agente de FAQ, quem
    // perguntava "vocês atendem planos?" era jogado no fluxo de agendamento e
    // recebia "me informe seu Nome Completo". Essas dúvidas agora são do
    // agente de FAQ (lib/twilio-faq-bot.ts), que orienta a responder AGENDAR
    // quando a pessoa realmente quer marcar.
    const triggers = ["agendar", "anamnese", "marcar avaliacao", "marcar avaliação", "marcar consulta"];
    const isAnamnesisIntent = triggers.some((t) => normBody.includes(t));

    if (isAnamnesisIntent) {
      // Iniciar fluxo
      await supabase
        .from("chatbot_sessions")
        .update({
          current_step: "awaiting_guardian_name",
          collected_data: { started_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq("phone_number", phone);

      return {
        handled: true,
        replyMessage:
          "Olá! 💙 Boas-vindas ao *FaçaAmigos*! 🧩\n\n" +
          "Vou te ajudar no agendamento da avaliação.\n\n" +
          "Para começar, qual o seu *Nome Completo* (Responsável)?",
      };
    }

    return { handled: false, replyMessage: "" };
  }

  // 3. Etapa: Aguardando Nome do Responsável (nome completo, com sobrenome —
  // sem isso o lead/responsável não pode ser criado).
  if (currentStep === "awaiting_guardian_name") {
    const guardianName = parseFullNameAnswer(rawBody, normalizeFullName);
    if (!guardianName) {
      return {
        handled: true,
        replyMessage: "Preciso do seu nome completo, com sobrenome. Por favor, me informe:",
      };
    }

    data.guardian_name = guardianName;
    await persistStep(supabase, phone, "awaiting_guardian_cpf", data);

    return {
      handled: true,
      replyMessage: `Obrigado, *${data.guardian_name}*! 💙\n\nAgora, informe o seu *CPF* (somente números):`,
    };
  }

  // 4. Etapa: Aguardando CPF do Responsável
  if (currentStep === "awaiting_guardian_cpf") {
    const cpfDigits = cleanCPF(rawBody);
    if (cpfDigits.length !== 11) {
      return {
        handled: true,
        replyMessage: "CPF inválido. Digite os 11 números do seu CPF:",
      };
    }

    data.guardian_cpf = cpfDigits;
    await persistStep(supabase, phone, "awaiting_guardian_email", data);

    return {
      handled: true,
      replyMessage: "Perfeito! 🤝 Qual o seu *e-mail* (do responsável)? Vamos usá-lo para enviar comunicados e documentos.",
    };
  }

  // 4b. Etapa: Aguardando E-mail do Responsável. O cliente quer o e-mail de
  // todos os responsáveis: a primeira recusa ("não tenho"/"pular") é
  // contestada uma vez; só a segunda é aceita e segue com o e-mail vazio.
  if (currentStep === "awaiting_guardian_email") {
    const decision = decideGuardianEmailStep(rawBody, data.guardian_email_asked_again === true, normalizeEmail);

    if (decision.action === "invalid") {
      return {
        handled: true,
        replyMessage: "E-mail inválido. Digite um e-mail no formato *nome@exemplo.com* (ou responda *NÃO TENHO*):",
      };
    }

    if (decision.action === "reask") {
      data.guardian_email_asked_again = true;
      await persistStep(supabase, phone, "awaiting_guardian_email", data);

      return {
        handled: true,
        replyMessage:
          "Entendo! 💙 Mas o e-mail é importante para a clínica manter contato e enviar documentos. " +
          "Se tiver algum (o seu ou de outro responsável), digite aqui. Se realmente não tiver, responda *NÃO TENHO* novamente.",
      };
    }

    data.guardian_email = decision.action === "save" ? decision.email : "";
    delete data.guardian_email_asked_again;
    await persistStep(supabase, phone, "awaiting_child_name", data);

    return {
      handled: true,
      replyMessage:
        (decision.action === "save" ? "E-mail anotado! ✅\n\n" : "Tudo bem, seguimos sem e-mail por enquanto. 👍\n\n") +
        "Qual o *Nome Completo da Criança ou Adolescente* que fará a avaliação?",
    };
  }

  // 5. Etapa: Aguardando Nome da Criança/Adolescente (nome completo)
  if (currentStep === "awaiting_child_name") {
    const childName = parseFullNameAnswer(rawBody, normalizeFullName);
    if (!childName) {
      return {
        handled: true,
        replyMessage: "Preciso do nome completo da criança ou adolescente, com sobrenome. Por favor, me informe:",
      };
    }

    data.child_name = childName;
    await persistStep(supabase, phone, "awaiting_child_birth_date", data);

    return {
      handled: true,
      replyMessage: `Anotado! 🎈 Qual a *Data de Nascimento* de ${data.child_name}? (DD/MM/AAAA):`,
    };
  }

  // 5b. Etapa: Aguardando Data de Nascimento da Criança/Adolescente
  if (currentStep === "awaiting_child_birth_date") {
    const isoDate = parseBrazilianDate(rawBody);
    if (!isoDate) {
      return {
        handled: true,
        replyMessage: "Data inválida. Informe no formato DD/MM/AAAA (ex: 15/03/2018):",
      };
    }

    data.child_birth_date = isoDate;
    await persistStep(supabase, phone, "awaiting_payment_mode", data);

    return {
      handled: true,
      replyMessage:
        "Anotado! 🧩 O atendimento será por *plano de saúde (convênio)* ou *particular*?\n\n" +
        "Responda *CONVÊNIO* ou *PARTICULAR*.",
    };
  }

  // 5c. Etapa: Convênio ou Particular. Particular não tem laudo, guia,
  // carteirinha nem número de cartão — vai direto pra validação do supervisor.
  if (currentStep === "awaiting_payment_mode") {
    if (normBody.includes("particular")) {
      data.is_private = true;
      return finalizeAnamnesisRequest(supabase, phone, data);
    }

    if (normBody.includes("convenio") || normBody.includes("plano") || normBody.includes("saude")) {
      data.is_private = false;
      await persistStep(supabase, phone, "awaiting_has_laudo", data);

      return {
        handled: true,
        replyMessage:
          `Perfeito! 🧩 ${data.child_name} já possui *Laudo Médico*?\n\n` +
          "Responda *SIM* ou *NÃO*.",
      };
    }

    return {
      handled: true,
      replyMessage: "Por favor, responda *CONVÊNIO* (plano de saúde) ou *PARTICULAR*.",
    };
  }

  // 6. Etapa: Confirmação de Laudo Médico
  if (currentStep === "awaiting_has_laudo") {
    if (normBody.includes("nao") || normBody === "n") {
      // Contorno educado quando não possui laudo. A sessão é zerada, mas o lead
      // já deu dados: o rascunho da fila de Pendências guarda tudo (e o
      // "não tenho laudo") para a recepção acompanhar e cobrar depois.
      data.has_laudo = false;
      await syncBotDraft({ phone, data, step: "awaiting_has_laudo" });
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
          "Compreendemos! 💙 Para o agendamento pelo plano de saúde, o *Laudo Médico* é essencial.\n\n" +
          "Assim que tiver o documento em mãos com o especialista, basta nos enviar uma mensagem por aqui para agendarmos! 🌱✨",
      };
    }

    if (normBody.includes("sim") || normBody === "s") {
      await persistStep(supabase, phone, "awaiting_laudo_pdf", data);

      return {
        handled: true,
        replyMessage:
          "Ótimo! 📄 Envie a foto ou PDF do *Laudo Médico* por aqui.",
      };
    }

    return {
      handled: true,
      replyMessage: "Por favor, responda apenas *SIM* se já possui o Laudo ou *NÃO* caso não possua.",
    };
  }

  // 7. Etapa: Upload do PDF do Laudo
  if (currentStep === "awaiting_laudo_pdf") {
    const saved = await saveStepMedia(
      params,
      phone,
      data,
      "laudo",
      "Arquivo não identificado. Por favor, envie o PDF ou foto do Laudo Médico por aqui.",
    );
    if (!saved.ok) return { handled: true, replyMessage: saved.reply };

    data.laudo_pdf_url = saved.pointers[0];
    await persistStep(supabase, phone, "awaiting_has_guia", data);

    return {
      handled: true,
      replyMessage:
        "Laudo recebido! ✅\n\n" +
        "Já possui a *Guia de Autorização* liberada pelo plano? (Não é obrigatória — se ainda não tiver, a gente autoriza aqui na clínica.)\n\n" +
        "Responda *SIM* ou *NÃO*." +
        saved.note,
    };
  }

  // 8. Etapa: Confirmação de Guia de Autorização (opcional)
  if (currentStep === "awaiting_has_guia") {
    if (normBody.includes("nao") || normBody === "n") {
      // Sem guia não trava o agendamento: a clínica autoriza depois. Segue
      // direto pra carteirinha.
      await persistStep(supabase, phone, "awaiting_carteirinha_frente", data);

      return {
        handled: true,
        replyMessage:
          "Tudo bem! 💙 A guia não é obrigatória — a autorização a gente faz aqui na clínica.\n\n" +
          "Agora envie a foto da *Carteirinha do Plano* — frente e verso (duas fotos), ou um único PDF com as duas páginas.\n\n" +
          "Pode mandar a *frente* primeiro.",
      };
    }

    if (normBody.includes("sim") || normBody === "s") {
      await persistStep(supabase, phone, "awaiting_guia_pdf", data);

      return {
        handled: true,
        replyMessage: "Excelente! 📄 Envie a foto ou PDF da *Guia de Autorização* por aqui.",
      };
    }

    return {
      handled: true,
      replyMessage: "Por favor, responda apenas *SIM* se já possui a Guia ou *NÃO* caso não possua.",
    };
  }

  // 9. Etapa: Upload do PDF da Guia de Autorização
  if (currentStep === "awaiting_guia_pdf") {
    const saved = await saveStepMedia(
      params,
      phone,
      data,
      "guia",
      "Arquivo não identificado. Por favor, envie a foto ou PDF da Guia de Autorização.",
    );
    if (!saved.ok) return { handled: true, replyMessage: saved.reply };

    data.guia_pdf_url = saved.pointers[0];
    await persistStep(supabase, phone, "awaiting_carteirinha_frente", data);

    return {
      handled: true,
      replyMessage:
        "Guia recebida! ✅\n\n" +
        "Agora envie a foto da *Carteirinha do Plano* — frente e verso (duas fotos), ou um único PDF com as duas páginas.\n\n" +
        "Pode mandar a *frente* primeiro." +
        saved.note,
    };
  }

  // 9b. Etapa: Upload da foto/PDF da frente da Carteirinha do Plano
  if (currentStep === "awaiting_carteirinha_frente") {
    const saved = await saveStepMedia(
      params,
      phone,
      data,
      "carteirinha",
      "Arquivo não identificado. Por favor, envie a foto ou PDF da Carteirinha do Plano.",
    );
    if (!saved.ok) return { handled: true, replyMessage: saved.reply };

    // PDF único cobre frente e verso, e duas fotos na mesma mensagem já são
    // frente+verso — nesses casos não precisa pedir a segunda foto.
    const { front, back } = splitCardPointers(saved.pointers);
    data.carteirinha_frente_url = front;
    if (back) {
      data.carteirinha_verso_url = back;
      return askCardNumber(supabase, phone, data, `Carteirinha recebida! ✅${saved.note}`);
    }

    await persistStep(supabase, phone, "awaiting_carteirinha_verso", data);

    return {
      handled: true,
      replyMessage: `Frente recebida! ✅\n\nAgora envie a foto do *verso* da Carteirinha do Plano.${saved.note}`,
    };
  }

  // 9c. Etapa: Upload da foto do verso da Carteirinha do Plano
  if (currentStep === "awaiting_carteirinha_verso") {
    const saved = await saveStepMedia(
      params,
      phone,
      data,
      "carteirinha",
      "Arquivo não identificado. Por favor, envie a foto ou PDF do verso da Carteirinha do Plano.",
    );
    if (!saved.ok) return { handled: true, replyMessage: saved.reply };

    data.carteirinha_verso_url = saved.pointers[0];
    return askCardNumber(supabase, phone, data, `Verso recebido! ✅${saved.note}`);
  }

  // 9d. Etapa: Número do cartão do plano (texto) & Criação da Requisição de Validação
  if (currentStep === "awaiting_card_number") {
    // Só o número importa: aceita "0 123 456789 00-1" mas exige um mínimo de
    // caracteres alfanuméricos (carteirinhas variam de 8 a 20 dígitos/letras).
    const cardNumber = rawBody.replace(/[^A-Za-z0-9]/g, "");
    if (cardNumber.length < 6) {
      return {
        handled: true,
        replyMessage: "Não consegui identificar o número. Digite o *número do cartão* (número da carteirinha) do plano, exatamente como está impresso:",
      };
    }

    data.card_number = cardNumber;
    return finalizeAnamnesisRequest(supabase, phone, data);
  }

  // 10. Etapa: Aguardando Aprovação do Supervisor
  if (currentStep === "pending_supervisor") {
    if (data.is_private !== true) {
      return {
        handled: true,
        replyMessage:
          "Olá! Sua solicitação está em análise pela supervisão. 💙\n\n" +
          "No prazo de até *7 dias* daremos uma devolutiva sobre o processo de autorização junto ao plano, para então agendarmos a avaliação.",
      };
    }
    return {
      handled: true,
      replyMessage:
        "Olá! Sua solicitação está em análise pela supervisão. 💙\n\n" +
        "Assim que validados, enviaremos os horários disponíveis por aqui!",
    };
  }

  // 11. Etapa: Escolha do Slot de Horário pelo Responsável (Pós-Aprovação do Supervisor)
  if (currentStep === "awaiting_slot_selection") {
    const slots = (data.available_slots as Array<{ index: number; label: string; starts_at: string; ends_at: string; therapist_id: string; room_id: string }>) || [];
    
    const choiceNum = parseInt(rawBody.trim(), 10);
    const selectedSlot = slots.find((s) => s.index === choiceNum);

    if (!choiceNum || !selectedSlot) {
      return {
        handled: true,
        replyMessage:
          "Opção inválida. Digite apenas o **número** correspondente ao horário desejado (ex: 1, 2...).",
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
        replyMessage:
          `⚠️ ${errReason}\n\n` +
          "Por favor, escolha outro número de horário disponível.",
      };
    }

    // Resetar sessão após agendamento concluído com sucesso
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
