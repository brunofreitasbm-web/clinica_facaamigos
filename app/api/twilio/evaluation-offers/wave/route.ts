import { NextRequest, NextResponse } from "next/server";
import { runEvaluationOfferWave } from "@/lib/evaluation-offer-wave";

export const maxDuration = 60;

/**
 * 1ª onda de disparos da oferta de horários (lib/evaluation-offer-wave.ts). Chamado de
 * 5 em 5 minutos pelo pg_cron de supabase/migrations/20261030120000_evaluation_offer_wave.sql;
 * só age com a chave ligada, em dia útil, das 08h às 18h. `?dry=1` lista quem receberia,
 * sem enviar nada (conferência manual, com o header x-cron-secret).
 */
export async function POST(req: NextRequest) {
  const envCronSecret = process.env.CRON_SECRET;
  const cronSecret = req.headers.get("x-cron-secret");
  if (!envCronSecret || !cronSecret || cronSecret !== envCronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const result = await runEvaluationOfferWave({ dryRun: dry });
    // Dry-run devolve só a contagem e os nomes (dado de saúde de criança não sai em log aberto).
    if (result.status === "dry_run") {
      return NextResponse.json({ status: result.status, total: result.candidates.length, patients: result.candidates.map((c) => c.patientName) });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Evaluation Wave Error]:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
