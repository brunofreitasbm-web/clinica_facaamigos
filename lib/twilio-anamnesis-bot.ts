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
    const triggers = ["agendar", "anamnese", "avaliacao", "consulta", "primeira vez", "triagem", "plano", "laudo", "guia"];
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
          "Olá! 👋 Que bom te ver por aqui. Vou te ajudar a realizar o agendamento da *Avaliação / Anamnese* da criança pelo plano de saúde.\n\n" +
          "Para começar, por favor, me informe o seu *Nome Completo* (Nome do Responsável):",
      };
    }

    return { handled: false, replyMessage: "" };
  }

  // 3. Etapa: Aguardando Nome do Responsável
  if (currentStep === "awaiting_guardian_name") {
    if (rawBody.trim().length < 3) {
      return {
        handled: true,
        replyMessage: "Por favor, informe seu nome completo para prosseguirmos:",
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
      replyMessage: `Obrigado, *${data.guardian_name}*!\n\nAgora, por favor, me informe o seu *CPF* (somente números ou formatado):`,
    };
  }

  // 4. Etapa: Aguardando CPF do Responsável
  if (currentStep === "awaiting_guardian_cpf") {
    const cpfDigits = cleanCPF(rawBody);
    if (cpfDigits.length !== 11) {
      return {
        handled: true,
        replyMessage: "O CPF informado parece inválido. Por favor, digite os 11 números do seu CPF:",
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
      replyMessage: "Perfeito! Agora me informe o *Nome Completo da Criança* que fará a avaliação:",
    };
  }

  // 5. Etapa: Aguardando Nome da Criança
  if (currentStep === "awaiting_child_name") {
    if (rawBody.trim().length < 2) {
      return {
        handled: true,
        replyMessage: "Por favor, me informe o nome completo da criança:",
      };
    }

    data.child_name = rawBody.trim();
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
        `Anotado! Atendimento para a criança *${data.child_name}*.\n\n` +
        "Ela já possui *Laudo Médico* expedido pelo neuropediatra/psiquiatra?\n\n" +
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
          "Compreendemos! ℹ️ Para o agendamento de Avaliação/Anamnese coberto pelo plano de saúde, a apresentação do *Laudo Médico* é obrigatória.\n\n" +
          "Orientamos que entre em contato com o seu médico especialista ou com a operadora do seu plano de saúde para a emissão do laudo. Assim que tiver o documento em mãos, basta nos enviar uma mensagem por aqui para darmos continuidade!",
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
          "Ótimo! 📄 Por favor, **envie agora o PDF do Laudo Médico** anexado nesta conversa do WhatsApp.",
      };
    }

    return {
      handled: true,
      replyMessage: "Por favor, responda apenas **SIM** se já possui o Laudo Médico ou **NÃO** caso ainda não possua.",
    };
  }

  // 7. Etapa: Upload do PDF do Laudo
  if (currentStep === "awaiting_laudo_pdf") {
    const isPdf = params.mediaContentType0?.includes("pdf") || rawBody.toLowerCase().endsWith(".pdf");
    
    if (!params.mediaUrl0 && !isPdf) {
      return {
        handled: true,
        replyMessage: "Não identificamos um arquivo PDF anexado. Por favor, selecione o arquivo PDF do Laudo Médico e envie por aqui.",
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
        "Laudo recebido com sucesso! ✅\n\n" +
        "Agora, a criança já possui a *Guia de Autorização* liberada pelo plano de saúde para a avaliação?\n\n" +
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
          "Entendido! ℹ️ A *Guia de Autorização* do plano de saúde é um requisito indispensável para agendarmos a sessão de avaliação.\n\n" +
          "Por favor, solicite a emissão da guia junto ao seu convênio. Assim que for liberada, nos envie uma mensagem por aqui!",
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
        replyMessage: "Excelente! 📄 Por favor, **envie o PDF da Guia de Autorização** anexado nesta conversa.",
      };
    }

    return {
      handled: true,
      replyMessage: "Por favor, responda apenas **SIM** se já possui a Guia de Autorização ou **NÃO** caso não possua.",
    };
  }

  // 9. Etapa: Upload do PDF da Guia de Autorização & Criação da Requisição de Validação
  if (currentStep === "awaiting_guia_pdf") {
    const isPdf = params.mediaContentType0?.includes("pdf") || rawBody.toLowerCase().endsWith(".pdf");

    if (!params.mediaUrl0 && !isPdf) {
      return {
        handled: true,
        replyMessage: "Não identificamos o anexo em PDF da guia. Por favor, envie o documento PDF da Guia de Autorização.",
      };
    }

    const mediaUrl = params.mediaUrl0 || "";
    const guiaUrl = await uploadTwilioMediaToStorage(mediaUrl, `guia_${phone}.pdf`);
    data.guia_pdf_url = guiaUrl || mediaUrl;

    // Inserir registro na fila de aprovação do supervisor
    const { data: reqData, error: reqErr } = await supabase
      .from("anamnesis_scheduling_requests")
      .insert({
        guardian_name: data.guardian_name,
        guardian_phone: phone,
        guardian_cpf: data.guardian_cpf,
        child_name: data.child_name,
        laudo_pdf_url: data.laudo_pdf_url,
        guia_pdf_url: data.guia_pdf_url,
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
        "Tudo certo! 🎉 Recebemos todas as suas informações e os documentos em PDF (Laudo e Guia).\n\n" +
        "O supervisor da clínica irá analisar e validar os documentos. Assim que for aprovado, enviaremos os horários e datas vagos por aqui para você escolher seu agendamento.\n\n" +
        "Agradecemos o seu contato!",
    };
  }

  // 10. Etapa: Aguardando Aprovação do Supervisor
  if (currentStep === "pending_supervisor") {
    return {
      handled: true,
      replyMessage:
        "Olá! Sua documentação (Laudo e Guia) já foi recebida e está na fila de análise do nosso supervisor clínico.\n\n" +
        "Assim que for validada, enviaremos a lista de datas e horários disponíveis diretamente nesta conversa!",
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
          "Opção inválida. Por favor, digite apenas o **número** correspondente ao horário desejado da lista (ex: 1, 2, 3...).",
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
          "Por favor, responda com outro número de horário vago disponível.",
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
        `✅ *AGENDAMENTO CONFIRMADO COM SUCESSO!*\n\n` +
        `👤 **Paciente:** ${data.child_name}\n` +
        `📅 **Data e Horário:** ${formattedDate}\n` +
        `📍 **Local:** Clínica de Desenvolvimento Infantil - Sala de Anamnese\n\n` +
        "Sua sessão de Avaliação/Anamnese já está reservada no nosso sistema. Lembre-se de trazer os documentos originais no dia da consulta.\n\n" +
        "Aguardamos vocês!",
    };
  }

  return { handled: false, replyMessage: "" };
}
