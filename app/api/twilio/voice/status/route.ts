import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEmergencyVoiceCall, sendEmergencyFallback } from "@/lib/twilio-voice";

const MAX_ATTEMPTS = 2;

type LogCallStatus = "queued" | "ringing" | "completed" | "no-answer" | "busy" | "failed";

/**
 * Mapeia o CallStatus reportado pelo Twilio para os valores aceitos pelo
 * CHECK constraint de voice_emergency_logs.call_status (ver
 * supabase/migrations/20260906000012_voice_emergency.sql). Twilio manda
 * também `initiated`/`in-progress`/`canceled`, que não existem nessa
 * constraint — tratamos como "ringing" (chamada em andamento) por padrão.
 */
function mapCallStatus(twilioStatus: string): LogCallStatus {
  switch (twilioStatus) {
    case "completed":
    case "answered":
      return "completed";
    case "no-answer":
    case "busy":
    case "failed":
      return twilioStatus;
    case "queued":
    case "initiated":
    case "ringing":
    case "in-progress":
    default:
      return "ringing";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const logId = searchParams.get("logId");
    const patientName = searchParams.get("patientName") ?? "";
    const time = searchParams.get("time") ?? "";

    if (!logId) {
      console.error("[Twilio Voice Status] logId ausente na query string.");
      return new NextResponse(null, { status: 200 });
    }

    const formData = await req.formData();
    const twilioStatus = formData.get("CallStatus")?.toString() ?? "";
    const callSid = formData.get("CallSid")?.toString() ?? null;

    const mappedStatus = mapCallStatus(twilioStatus);
    const admin = createAdminClient();

    const { data: log, error: fetchError } = await admin
      .from("voice_emergency_logs")
      .select("id, phone_number, attempt_number, fallback_sent")
      .eq("id", logId)
      .maybeSingle();

    if (fetchError || !log) {
      console.error("[Twilio Voice Status] Não foi possível localizar o log:", fetchError);
      return new NextResponse(null, { status: 200 });
    }

    await admin
      .from("voice_emergency_logs")
      .update({
        call_status: mappedStatus,
        call_sid: callSid ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);

    if (mappedStatus === "no-answer" || mappedStatus === "busy" || mappedStatus === "failed") {
      if (log.attempt_number < MAX_ATTEMPTS) {
        const nextAttempt = log.attempt_number + 1;
        await admin
          .from("voice_emergency_logs")
          .update({ attempt_number: nextAttempt, updated_at: new Date().toISOString() })
          .eq("id", logId);

        const redialResult = await createEmergencyVoiceCall({
          to: log.phone_number,
          logId,
          patientName,
          time,
        });

        if (redialResult.success && redialResult.callSid) {
          await admin
            .from("voice_emergency_logs")
            .update({ call_sid: redialResult.callSid, updated_at: new Date().toISOString() })
            .eq("id", logId);
        }
      } else if (!log.fallback_sent) {
        await sendEmergencyFallback({ to: log.phone_number, patientName, time });
        await admin
          .from("voice_emergency_logs")
          .update({ fallback_sent: true, updated_at: new Date().toISOString() })
          .eq("id", logId);
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[Twilio Voice Status Error]:", error);
    return new NextResponse(null, { status: 200 });
  }
}
