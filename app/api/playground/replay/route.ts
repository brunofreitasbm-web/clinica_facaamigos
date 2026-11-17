import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSealed } from "@/lib/playground/sealed";
import { readSignedBody, respond } from "@/lib/playground/route";
import { concludeSeries, recordEntries, recordVisitAction } from "@/lib/playground/service";

// Reenvio da fila cifrada do PDV (clínica fora do ar na hora de salvar). O PDV
// só repassa o envelope; aqui ele é decifrado e executado como a ação original,
// com os mesmos carimbos de horário e as mesmas chaves de idempotência.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signed = await readSignedBody(req);
  if (!signed.ok) return signed.response;

  const sealed = typeof signed.body.sealed === "string" ? signed.body.sealed : "";
  const payload = decryptSealed(process.env.PLAYGROUND_BRIDGE_PRIVATE_KEY, sealed);
  if (!payload) {
    return NextResponse.json(
      { ok: false, code: "bad_request", error: "Envelope inválido ou chave não configurada." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const now = new Date();
  if (payload.action === "visit") return respond(await recordVisitAction(admin, payload.body, now));
  if (payload.action === "entries") return respond(await recordEntries(admin, payload.body, now));
  return respond(await concludeSeries(admin, payload.body, now));
}
