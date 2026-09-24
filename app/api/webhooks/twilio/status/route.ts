import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTwilioSignature } from "@/lib/twilio";

/**
 * Webhook de Callback de Status da Twilio.
 * Atualiza o `delivery_status` da tabela `messages` em tempo real
 * quando a Twilio/Meta confirma o envio, entrega ou falha (ex: Erro 63016).
 */

// Ordem de progresso do status — usada para nunca deixar um callback atrasado
// (ex.: "delivered" chegando depois de "read", reentrega do Twilio) regredir
// o status já registrado. failed/undelivered são terminais e nunca cedem
// lugar a um status "mais antigo".
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sending: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 5,
  undelivered: 5,
};

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let messageSid = "";
    let messageStatus = "";
    let errorCode = "";
    let signatureParams: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      messageSid = formData.get("MessageSid")?.toString() || formData.get("SmsSid")?.toString() || "";
      messageStatus = formData.get("MessageStatus")?.toString() || "";
      errorCode = formData.get("ErrorCode")?.toString() || "";
      for (const [key, value] of formData.entries()) {
        signatureParams[key] = value.toString();
      }
    } else {
      // A Twilio sempre manda callbacks de status como x-www-form-urlencoded;
      // este ramo cobre só reenvios manuais/teste como texto puro.
      const text = await req.text();
      const params = new URLSearchParams(text);
      messageSid = params.get("MessageSid") || params.get("SmsSid") || "";
      messageStatus = params.get("MessageStatus") || "";
      errorCode = params.get("ErrorCode") || "";
      signatureParams = Object.fromEntries(params.entries());
    }

    if (!isValidTwilioSignature(req, signatureParams)) {
      console.error("[Twilio Status Webhook Signature Error]: assinatura inválida ou ausente — requisição rejeitada.");
      return NextResponse.json({ success: false, error: "Assinatura inválida." }, { status: 403 });
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

    // Não regredir um status mais avançado por causa de um callback
    // atrasado/reentregue (ex.: "delivered" chegando depois de "read").
    const { data: existing, error: fetchError } = await supabase
      .from("messages")
      .select("delivery_status")
      .eq("twilio_sid", messageSid)
      .maybeSingle();

    if (fetchError) {
      console.error("[Twilio Status Webhook DB Error]:", fetchError);
    }

    const currentRank = existing?.delivery_status ? STATUS_RANK[existing.delivery_status] ?? -1 : -1;
    const nextRank = STATUS_RANK[dbStatus] ?? -1;

    if (nextRank < currentRank) {
      return NextResponse.json({ success: true, skipped: "status_regression" });
    }

    const { error } = await supabase
      .from("messages")
      .update({
        delivery_status: dbStatus,
        error_code: errorCode || null,
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
