import { NextResponse, type NextRequest } from "next/server";
import { isGeminiConfigured, transcribeToEvolutionText } from "@/lib/gemini";
import { PLAYGROUND_MAX_AUDIO_BASE64_LENGTH } from "@/lib/playground/constants";
import { readSignedBody } from "@/lib/playground/route";

// Transcreve um áudio curto (até ~1 min) em texto de evolução. O áudio não é
// guardado: é transcrito e descartado.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signed = await readSignedBody(req);
  if (!signed.ok) return signed.response;

  const audioBase64 = typeof signed.body.audioBase64 === "string" ? signed.body.audioBase64 : "";
  const mimeType = typeof signed.body.mimeType === "string" ? signed.body.mimeType : "audio/webm";
  if (!audioBase64.trim()) {
    return NextResponse.json({ ok: false, code: "bad_request", error: "Nenhum áudio recebido." }, { status: 400 });
  }
  if (audioBase64.length > PLAYGROUND_MAX_AUDIO_BASE64_LENGTH) {
    return NextResponse.json(
      { ok: false, code: "bad_request", error: "Áudio longo demais: grave até 1 minuto." },
      { status: 400 },
    );
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { ok: false, code: "unavailable", error: "Transcrição indisponível agora: digite a evolução." },
      { status: 503 },
    );
  }

  const result = await transcribeToEvolutionText(audioBase64, mimeType);
  if (!result.success) {
    return NextResponse.json({ ok: false, code: "unavailable", error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true, text: result.text });
}
