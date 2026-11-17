import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSignedBody, respond } from "@/lib/playground/route";
import { getTodayPayload } from "@/lib/playground/service";

// Ponte PDV → clínica (docs/playground-bridge-contract.md). Autenticada por
// HMAC; nunca chamada por navegador.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signed = await readSignedBody(req);
  if (!signed.ok) return signed.response;
  return respond(await getTodayPayload(createAdminClient(), signed.body, new Date()));
}
