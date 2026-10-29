import { NextRequest, NextResponse } from "next/server";
import { sendPendingOkDigest } from "@/lib/evaluation-offer-pending-digest";

export const maxDuration = 60;

/**
 * Resumo das 8h (seg–sex) dos horários escolhidos pelos responsáveis que aguardam o
 * OK da supervisão (lib/evaluation-offer-pending-digest.ts). Chamado pelo pg_cron de
 * supabase/migrations/20261030120000_evaluation_offer_wave.sql.
 */
export async function POST(req: NextRequest) {
  const envCronSecret = process.env.CRON_SECRET;
  const cronSecret = req.headers.get("x-cron-secret");
  if (!envCronSecret || !cronSecret || cronSecret !== envCronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendPendingOkDigest();
    // Falha de envio vira 502: o pg_cron registra o job como erro em vez de "sucesso" mudo.
    return NextResponse.json(result, { status: result.error ? 502 : 200 });
  } catch (error) {
    console.error("[Evaluation Pending Digest Error]:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
