import { isValidCronSecret } from "@/lib/cron-auth";
import { NextRequest, NextResponse } from "next/server";
import { runHandoffResumeTick } from "@/lib/handoff-resume";

export const maxDuration = 60;

/**
 * Cron (pg_cron a cada 5 min, migration 20261107120000): oferece retomar o fluxo a quem pediu
 * atendente e não foi atendido, e alerta a equipe de conversa pendente além do SLA.
 * Mesmo padrão de autenticação de /api/twilio/inbound-retry.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!isValidCronSecret(cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runHandoffResumeTick());
  } catch (err) {
    console.error("[Twilio Handoff Resume] falhou:", err);
    return NextResponse.json({ error: "tick_failed" }, { status: 500 });
  }
}
