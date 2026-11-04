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
  const envCronSecret = process.env.CRON_SECRET;
  const cronSecret = req.headers.get("x-cron-secret");
  if (!envCronSecret || !cronSecret || cronSecret !== envCronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ sent: 0, failed: 0, disabled: true });
}
