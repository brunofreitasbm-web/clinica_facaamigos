import { NextRequest, NextResponse } from "next/server";
import { tickEvaluationOffers } from "@/lib/evaluation-offer";

export const maxDuration = 60;

/**
 * Ciclo de vida da oferta automática de horários da 1ª avaliação
 * (lib/evaluation-offer.ts): lembrete com 24h sem resposta e expiração com
 * 48h — a criança volta para "Prontos para agendar" e a supervisão agenda
 * manualmente. Chamado a cada 30min pelo pg_cron configurado em
 * supabase/migrations/20261029140000_evaluation_offers_cron.sql (mesmo
 * padrão de /api/twilio/anamnesis-prefill/trigger e /api/twilio/inbound-retry).
 */
export async function POST(req: NextRequest) {
  const envCronSecret = process.env.CRON_SECRET;
  const cronSecret = req.headers.get("x-cron-secret");
  if (!envCronSecret || !cronSecret || cronSecret !== envCronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await tickEvaluationOffers();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Evaluation Offers Tick Error]:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
