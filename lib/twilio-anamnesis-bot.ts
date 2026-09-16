import { createAdminClient } from "@/lib/supabase/admin";
import { formatE164Phone } from "@/lib/twilio";

export interface TwilioIncomingParams {
  from: string;
  body: string;
  mediaUrl0?: string;
  mediaContentType0?: string;
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
 * Faz download do arquivo PDF do Twilio e insere no Supabase Storage (bucket `patient-documents`)
 */
async function uploadTwilioMediaToStorage(mediaUrl: string, filename: string): Promise<string | null> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    const headers: Record<string, string> = {};
    if (accountSid && authToken) {
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      headers["Authorization"] = `Basic ${authHeader}`;
    }

    const res = await fetch(mediaUrl, { headers });
    if (!res.ok) {
      console.error(`[Storage Upload] Falha ao baixar mídia Twilio: ${res.status} ${res.statusText}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = createAdminClient();

    // Assegura que o bucket privado `patient-documents` exista
    const { data: buckets } = await supabase.storage.listBuckets();
    const hasBucket = buckets?.some((b) => b.name === "patient-documents");
    if (!hasBucket) {
      await supabase.storage.createBucket("patient-documents", { public: true });
    }

    const storagePath = `anamnese-laudos-guias/${Date.now()}_${filename}`;
    const { data, error } = await supabase.storage
      .from("patient-documents")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("[Storage Upload Error]:", error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from("patient-documents")
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("[Storage Upload Exception]:", err);
    return null;
  }
}

/**
 * Insere a requisição na fila de aprovação do supervisor com Laudo, Guia e
 * Carteirinha já anexados, e coloca a sessão em `pending_supervisor` — chamado
 * tanto após o verso da carteirinha quanto direto após um PDF único que já
 * cobre as duas páginas.
 */
async function finalizeAnamnesisRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  phone: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
): Promise<{ handled: boolean; replyMessage: string }> {
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
      status: "pendente_supervisor",
    })
    .select("id")
    .single();

  if (reqErr) {
    console.error("[Anamnesis Request Insert Error]:", reqErr.message);
  }

  data.request_id = reqData?.id;

  await supabase
    .from("chatbot_sessions")
    .update({
      current_step: "pending_supervisor",
      collected_data: data,
      updated_at: new Date().toISOString(),
    })
    .eq("phone_number", phone);

  return {
    handled: true,
    replyMessage:
      "Tudo certo! 🎉 Recebemos as informações e documentos (Laudo, Guia e Carteirinha).\n\n" +
      "Nosso supervisor fará a validação rápida. Assim que aprovado, enviaremos os horários disponíveis por aqui para você escolher! 🧩💙",
  };
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
          "Vou te ajudar no agendamento da avaliação pelo plano de saúde.\n\n" +
          "Para começar, qual o seu *Nome Completo* (Responsável)?",
      };
    }

    return { handled: false, replyMessage: "" };
  }

  // 3. Etapa: Aguardando Nome do Responsável
  if (currentStep === "awaiting_guardian_name") {
    if (rawBody.trim().length < 3) {
      return {
        handled: true,
        replyMessage: "Por favor, me informe o seu nome completo:",
      };
    }

    data.guardian_name = rawBody.trim();
    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_guardian_cpf",
        collected_data: data,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

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
    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_child_name",
        collected_data: data,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

    return {
      handled: true,
      replyMessage: "Perfeito! 🤝 Qual o *Nome Completo da Criança ou Adolescente* que fará a avaliação?",
    };
  }

  // 5. Etapa: Aguardando Nome da Criança/Adolescente
  if (currentStep === "awaiting_child_name") {
    if (rawBody.trim().length < 2) {
      return {
        handled: true,
        replyMessage: "Por favor, me informe o nome completo da criança ou adolescente:",
      };
    }

    data.child_name = rawBody.trim();
    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_child_birth_date",
        collected_data: data,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

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
    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_has_laudo",
        collected_data: data,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

    return {
      handled: true,
      replyMessage:
        `Perfeito! 🧩 ${data.child_name} já possui *Laudo Médico*?\n\n` +
        "Responda *SIM* ou *NÃO*.",
    };
  }

  // 6. Etapa: Confirmação de Laudo Médico
  if (currentStep === "awaiting_has_laudo") {
    if (normBody.includes("nao") || normBody === "n") {
      // Contorno educado quando não possui laudo
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
      await supabase
        .from("chatbot_sessions")
        .update({
          current_step: "awaiting_laudo_pdf",
          collected_data: data,
          updated_at: new Date().toISOString(),
        })
        .eq("phone_number", phone);

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
    const isPdf = params.mediaContentType0?.includes("pdf") || rawBody.toLowerCase().endsWith(".pdf");
    
    if (!params.mediaUrl0 && !isPdf) {
      return {
        handled: true,
        replyMessage: "Arquivo não identificado. Por favor, envie o PDF ou foto do Laudo Médico por aqui.",
      };
    }

    const mediaUrl = params.mediaUrl0 || "";
    const laudoUrl = await uploadTwilioMediaToStorage(mediaUrl, `laudo_${phone}.pdf`);

    data.laudo_pdf_url = laudoUrl || mediaUrl;
    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_has_guia",
        collected_data: data,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

    return {
      handled: true,
      replyMessage:
        "Laudo recebido! ✅\n\n" +
        "Já possui a *Guia de Autorização* liberada pelo plano?\n\n" +
        "Responda *SIM* ou *NÃO*.",
    };
  }

  // 8. Etapa: Confirmação de Guia de Autorização
  if (currentStep === "awaiting_has_guia") {
    if (normBody.includes("nao") || normBody === "n") {
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
          "Entendido! 💙 A *Guia de Autorização* do plano é necessária para o agendamento.\n\n" +
          "Solicite a emissão no seu plano de saúde e nos avise assim que tiver em mãos!",
      };
    }

    if (normBody.includes("sim") || normBody === "s") {
      await supabase
        .from("chatbot_sessions")
        .update({
          current_step: "awaiting_guia_pdf",
          collected_data: data,
          updated_at: new Date().toISOString(),
        })
        .eq("phone_number", phone);

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
    const isPdf = params.mediaContentType0?.includes("pdf") || rawBody.toLowerCase().endsWith(".pdf");

    if (!params.mediaUrl0 && !isPdf) {
      return {
        handled: true,
        replyMessage: "Arquivo não identificado. Por favor, envie a foto ou PDF da Guia de Autorização.",
      };
    }

    const mediaUrl = params.mediaUrl0 || "";
    const guiaUrl = await uploadTwilioMediaToStorage(mediaUrl, `guia_${phone}.pdf`);
    data.guia_pdf_url = guiaUrl || mediaUrl;

    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_carteirinha_frente",
        collected_data: data,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

    return {
      handled: true,
      replyMessage:
        "Guia recebida! ✅\n\n" +
        "Agora envie a foto da *Carteirinha do Plano* — frente e verso (duas fotos), ou um único PDF com as duas páginas.\n\n" +
        "Pode mandar a *frente* primeiro.",
    };
  }

  // 9b. Etapa: Upload da foto/PDF da frente da Carteirinha do Plano
  if (currentStep === "awaiting_carteirinha_frente") {
    const isPdf = params.mediaContentType0?.includes("pdf") || rawBody.toLowerCase().endsWith(".pdf");

    if (!params.mediaUrl0 && !isPdf) {
      return {
        handled: true,
        replyMessage: "Arquivo não identificado. Por favor, envie a foto ou PDF da Carteirinha do Plano.",
      };
    }

    const mediaUrl = params.mediaUrl0 || "";
    const carteirinhaUrl = await uploadTwilioMediaToStorage(mediaUrl, `carteirinha_frente_${phone}.pdf`);
    data.carteirinha_frente_url = carteirinhaUrl || mediaUrl;

    // PDF único já cobre frente e verso — não precisa pedir a segunda foto.
    if (isPdf) {
      data.carteirinha_verso_url = data.carteirinha_frente_url;
      return finalizeAnamnesisRequest(supabase, phone, data);
    }

    await supabase
      .from("chatbot_sessions")
      .update({
        current_step: "awaiting_carteirinha_verso",
        collected_data: data,
        updated_at: new Date().toISOString(),
      })
      .eq("phone_number", phone);

    return {
      handled: true,
      replyMessage: "Frente recebida! ✅\n\nAgora envie a foto do *verso* da Carteirinha do Plano.",
    };
  }

  // 9c. Etapa: Upload da foto do verso da Carteirinha do Plano & Criação da Requisição de Validação
  if (currentStep === "awaiting_carteirinha_verso") {
    const isPdf = params.mediaContentType0?.includes("pdf") || rawBody.toLowerCase().endsWith(".pdf");

    if (!params.mediaUrl0 && !isPdf) {
      return {
        handled: true,
        replyMessage: "Arquivo não identificado. Por favor, envie a foto ou PDF do verso da Carteirinha do Plano.",
      };
    }

    const mediaUrl = params.mediaUrl0 || "";
    const carteirinhaUrl = await uploadTwilioMediaToStorage(mediaUrl, `carteirinha_verso_${phone}.pdf`);
    data.carteirinha_verso_url = carteirinhaUrl || mediaUrl;

    return finalizeAnamnesisRequest(supabase, phone, data);
  }

  // 10. Etapa: Aguardando Aprovação do Supervisor
  if (currentStep === "pending_supervisor") {
    return {
      handled: true,
      replyMessage:
        "Olá! Seus documentos (Laudo, Guia e Carteirinha) estão em análise pela supervisão. 💙\n\n" +
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
