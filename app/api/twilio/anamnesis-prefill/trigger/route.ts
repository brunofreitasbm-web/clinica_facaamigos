import { isValidCronSecret } from "@/lib/cron-auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Lembrete de anamnese pré-consulta (pg_cron, a cada 30min — ver
 * supabase/migrations/20260906000017_anamnesis_prefill_requests.sql).
 *
 * DESATIVADO: a pré-anamnese por WhatsApp foi descontinuada e o convite/lembrete
 * trazia os botões "Sim, vamos começar" / "Preencher na clínica". A rota continua
 * respondendo (o cron não quebra), mas não envia nada.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!isValidCronSecret(cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ sent: 0, failed: 0, disabled: true });
}
