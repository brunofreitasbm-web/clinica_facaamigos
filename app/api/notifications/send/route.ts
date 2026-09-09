import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTwilioNotificationAction } from "@/app/actions/twilio";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { to, message, channel = "whatsapp", patientId } = body;

    if (!to || !message) {
      return NextResponse.json(
        { error: "Campos 'to' (telefone) e 'message' (mensagem) são obrigatórios." },
        { status: 400 }
      );
    }

    const result = await sendTwilioNotificationAction({
      to,
      message,
      channel: channel === "sms" ? "sms" : "whatsapp",
      patientId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Falha no envio da mensagem via Twilio" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      channel: result.channel,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
