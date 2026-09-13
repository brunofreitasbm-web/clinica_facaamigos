import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook de Callback de Status da Twilio.
 * Atualiza o `delivery_status` da tabela `messages` em tempo real
 * quando a Twilio/Meta confirma o envio, entrega ou falha (ex: Erro 63016).
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let messageSid = "";
    let messageStatus = "";
    let errorCode = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      messageSid = formData.get("MessageSid")?.toString() || formData.get("SmsSid")?.toString() || "";
      messageStatus = formData.get("MessageStatus")?.toString() || "";
      errorCode = formData.get("ErrorCode")?.toString() || "";
    } else if (contentType.includes("application/json")) {
      const json = await req.json();
      messageSid = json.MessageSid || json.SmsSid || "";
      messageStatus = json.MessageStatus || "";
      errorCode = json.ErrorCode || "";
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      messageSid = params.get("MessageSid") || params.get("SmsSid") || "";
      messageStatus = params.get("MessageStatus") || "";
      errorCode = params.get("ErrorCode") || "";
    }

    if (!messageSid) {
      return NextResponse.json({ success: false, error: "MessageSid ausente." }, { status: 400 });
    }

    console.log(`[Twilio Status Webhook] SID: ${messageSid} | Status: ${messageStatus} | ErrorCode: ${errorCode}`);

    // Mapear status Twilio para o padrão interno de delivery_status
    let dbStatus = messageStatus;
    if (messageStatus === "undelivered" || messageStatus === "failed") {
      dbStatus = "failed";
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("messages")
      .update({
        delivery_status: dbStatus,
      })
      .eq("twilio_sid", messageSid);

    if (error) {
      console.error("[Twilio Status Webhook DB Error]:", error);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Twilio Status Webhook Error]:", err);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}
