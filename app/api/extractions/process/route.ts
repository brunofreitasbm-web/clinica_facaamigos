import { NextRequest, NextResponse } from "next/server";
import { claimAndProcessDrafts } from "@/lib/registration-drafts-process";

export const maxDuration = 60;

/**
 * Disparado a cada minuto pelo pg_cron configurado em
 * 20260907000001_registration_drafts.sql (mesmo padrão de
 * app/api/twilio/nps/trigger/route.ts: guarda x-cron-secret, service role
 * faz o trabalho). Processa até 3 rascunhos pendentes por execução; um
 * `?draft=<id>` opcional força o processamento de um rascunho específico
 * (usado pelo botão "Reprocessar" da tela de validação via
 * reprocessRegistrationDraft, que chama claimAndProcessDrafts diretamente —
 * esta rota GET/POST existe pro cron e para testes manuais com curl).
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const draftId = req.nextUrl.searchParams.get("draft") || undefined;

  try {
    const results = await claimAndProcessDrafts({ limit: 3, draftId });
    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error("[Extractions Process Route Error]:", error);
    const errMessage = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ success: false, error: errMessage }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Extraction worker ativo" });
}
