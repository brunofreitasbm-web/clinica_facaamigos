import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "FACAAMIGOS_WHATSAPP_TOKEN") {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ status: "Webhook Ativo", timestamp: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Simulação do processamento de mensagem recebida do paciente/família via WhatsApp
    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message) {
      const from = message.from;
      const text = message.text?.body?.toLowerCase() || "";

      let intent = "duvida";
      let replyText = "Olá! Sou a assistente virtual da Clínica FaçaAmigos. Como posso ajudar com os agendamentos?";

      if (text.includes("confirmar") || text.includes("sim") || text.includes("vou")) {
        intent = "confirmacao_agendamento";
        replyText = "Perfeito! Sua consulta/sessão foi confirmada na nossa agenda. Esperamos você!";
      } else if (text.includes("desmarcar") || text.includes("cancelar") || text.includes("reagendar")) {
        intent = "reagendamento";
        replyText = "Compreendido! Vamos notificar a recepção para oferecer novas opções de horários.";
      }

      return NextResponse.json({
        success: true,
        from,
        intent,
        aiReply: replyText,
      });
    }

    return NextResponse.json({ success: true, message: "Evento recebido sem mensagens" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
