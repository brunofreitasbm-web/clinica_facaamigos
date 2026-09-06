// app/api/aba/session-note-voice/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGeminiConfigured, transcribeAndStructureSessionNote } from "@/lib/gemini";
import {
  BEHAVIOR_TYPES,
  BEHAVIOR_INTENSITIES,
  FAMILY_GUIDANCE_OPTIONS,
} from "@/lib/session-note-fields";

/**
 * Evolução clínica assistida por voz (PRD §9.4 — "evolução em 2 min").
 *
 * Recebe um áudio curto gravado pelo terapeuta ao fim da sessão, chama o
 * Gemini (transcrição + estruturação numa única chamada multimodal — ver
 * lib/gemini.ts) e devolve os campos SUGERIDOS de `session_notes.structured`
 * para o terapeuta revisar no formulário. Esta rota NUNCA salva a evolução
 * — quem grava em `session_notes` continua sendo `createSessionNote`
 * (app/terapeuta/evolucao/actions.ts), só depois que o terapeuta confirma.
 *
 * Contraste deliberado com app/api/aba/ai-assistant/route.ts: aquela rota
 * devolve um mock fixo mesmo sem processar nada de verdade — o tipo de
 * "fallback fabricado" que o projeto proíbe. Aqui, qualquer falha (chave
 * não configurada, erro HTTP do Gemini, JSON fora do formato esperado)
 * devolve erro explícito (success: false) — nunca um sucesso inventado.
 */

const MAX_AUDIO_BASE64_LENGTH = 15_000_000; // ~11MB de áudio binário; áudio de evolução é curto (segundos/poucos minutos)

export async function POST(req: NextRequest) {
  // Só terapeuta autenticado pode gerar sugestão de evolução — mesma
  // exigência de autenticação de qualquer Server Action deste módulo.
  // Não checamos aqui se ele é o dono da sessão porque esta rota não lê
  // nem grava nada em `appointments`/`session_notes`; quem faz essa
  // checagem (RLS + `createSessionNote`) é o passo de salvar, que já existe.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Sessão expirada. Faça login de novo." },
      { status: 401 },
    );
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "Transcrição por voz indisponível: GEMINI_API_KEY não configurada no servidor.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Corpo da requisição inválido (esperado JSON)." },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { success: false, error: "Corpo da requisição inválido." },
      { status: 400 },
    );
  }

  const { audioBase64, mimeType } = body as Record<string, unknown>;

  if (typeof audioBase64 !== "string" || !audioBase64.trim()) {
    return NextResponse.json(
      { success: false, error: "Nenhum áudio recebido." },
      { status: 400 },
    );
  }

  if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
    return NextResponse.json(
      { success: false, error: "Áudio muito longo. Grave um relato mais curto." },
      { status: 413 },
    );
  }

  const effectiveMimeType = typeof mimeType === "string" && mimeType.trim() ? mimeType : "audio/webm";

  const result = await transcribeAndStructureSessionNote(audioBase64, effectiveMimeType);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error ?? "Falha ao transcrever o áudio." },
      { status: 502 },
    );
  }

  // Validação contra o schema real (lib/session-note-fields.ts) — nunca
  // confiamos cegamente no texto/JSON devolvido pelo modelo. Valores fora
  // do enum são descartados silenciosamente em vez de quebrar a resposta;
  // o terapeuta revisa e corrige no formulário de qualquer forma.
  const validBehaviorValues = new Set(BEHAVIOR_TYPES.map((b) => b.value));
  const validIntensityValues = new Set(BEHAVIOR_INTENSITIES.map((i) => i.value));
  const validOrientationValues = new Set(FAMILY_GUIDANCE_OPTIONS.map((g) => g.value));

  const comportamentos = (result.comportamentos ?? [])
    .filter((c) => validBehaviorValues.has(c.tipo as (typeof BEHAVIOR_TYPES)[number]["value"]))
    .map((c) => ({
      tipo: c.tipo,
      intensidade: validIntensityValues.has(c.intensidade as (typeof BEHAVIOR_INTENSITIES)[number]["value"])
        ? c.intensidade
        : "leve",
    }));

  const orientacoes = (result.orientacoes ?? []).filter((o) =>
    validOrientationValues.has(o as (typeof FAMILY_GUIDANCE_OPTIONS)[number]["value"]),
  );

  const presenca =
    typeof result.presenca_engajamento === "number" &&
    Number.isInteger(result.presenca_engajamento) &&
    result.presenca_engajamento >= 1 &&
    result.presenca_engajamento <= 5
      ? result.presenca_engajamento
      : null;

  return NextResponse.json({
    success: true,
    suggestion: {
      presenca_engajamento: presenca,
      comportamentos,
      orientacoes,
      free_text: result.free_text ?? "",
    },
  });
}
