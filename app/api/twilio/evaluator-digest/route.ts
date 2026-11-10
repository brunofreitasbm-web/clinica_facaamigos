import { isValidCronSecret } from "@/lib/cron-auth";
import { NextRequest, NextResponse } from "next/server";
import { sendEvaluatorDailyDigest } from "@/lib/evaluator-daily-digest";

export const maxDuration = 60;

/**
 * E-mail diário (7h59) com as avaliações do dia de cada terapeuta avaliador
 * (lib/evaluator-daily-digest.ts). Chamado pelo pg_cron de
 * supabase/migrations/20261029150000_evaluator_digest_cron.sql. Também serve
 * para teste manual: POST com o header x-cron-secret.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!isValidCronSecret(cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendEvaluatorDailyDigest();
    // Falha de envio vira 502: o pg_cron registra o job como erro em vez de "sucesso" mudo.
    return NextResponse.json(result, { status: result.failed.length ? 502 : 200 });
  } catch (error) {
    console.error("[Evaluator Digest Error]:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
