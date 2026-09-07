import { NextRequest, NextResponse } from "next/server";
import { claimAndProcessIntakeBatches, sweepIntakeLeadsAwaitingDocuments } from "@/lib/insurance-intake-process";

export const maxDuration = 60;

/**
 * Disparado a cada minuto pelo pg_cron configurado em
 * 20260907170006_insurance_intake.sql (mesmo padrão de
 * app/api/extractions/process/route.ts): guarda x-cron-secret, service role
 * faz o trabalho. Processa até 2 lotes de "acolhimento oriundo de plano de
 * saúde" por execução e varre leads parados aguardando documentos há mais
 * de 30min. Um `?batch=<id>` opcional força o processamento de um lote
 * específico (usado pelo botão "Reprocessar" via reprocessIntakeBatch).
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const batchId = req.nextUrl.searchParams.get("batch") || undefined;

  try {
    const results = await claimAndProcessIntakeBatches({ limit: 2, batchId });
    const sweptCount = batchId ? 0 : await sweepIntakeLeadsAwaitingDocuments();
    return NextResponse.json({ processed: results.length, results, swept: sweptCount });
  } catch (error) {
    console.error("[Insurance Intake Process Route Error]:", error);
    const errMessage = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ success: false, error: errMessage }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Insurance intake worker ativo" });
}
