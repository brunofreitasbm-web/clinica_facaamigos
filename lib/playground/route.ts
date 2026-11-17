import { NextResponse } from "next/server";
import { verifyBridgeSignature, BRIDGE_SIGNATURE_HEADER, BRIDGE_TIMESTAMP_HEADER } from "./bridge-auth.ts";
import type { ServiceResult } from "./service";

/**
 * Lê e autentica o corpo de uma chamada da ponte (PDV → clínica). O corpo é
 * lido como texto bruto porque a assinatura cobre os bytes exatos.
 */
export async function readSignedBody(
  req: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const rawBody = await req.text();
  const verdict = verifyBridgeSignature({
    secret: process.env.PLAYGROUND_BRIDGE_SECRET,
    timestampHeader: req.headers.get(BRIDGE_TIMESTAMP_HEADER),
    signatureHeader: req.headers.get(BRIDGE_SIGNATURE_HEADER),
    rawBody,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!verdict.ok) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, code: "unauthorized", error: "Não autorizado." }, { status: 401 }),
    };
  }
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("corpo");
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, code: "bad_request", error: "Corpo inválido." }, { status: 400 }),
    };
  }
}

export function respond<T extends object>(result: ServiceResult<T>): NextResponse {
  if (result.ok) return NextResponse.json({ ok: true, ...result.data });
  return NextResponse.json({ ok: false, code: result.code, error: result.error }, { status: result.status });
}
