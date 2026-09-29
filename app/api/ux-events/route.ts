import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_BODY_BYTES, sanitizeBatch, sanitizeSessionId } from "@/lib/ux-friction";

/**
 * Recebe os sinais de fricção coletados no navegador
 * (components/friction-tracker.tsx) e grava em `ux_events`.
 *
 * Só quem está logado grava; a gravação em si usa service role (a tabela não
 * tem policy de INSERT, como `ai_usage_log`). Papel e clínica vêm do perfil no
 * servidor — nunca do corpo da requisição. O corpo passa por `sanitizeBatch`,
 * que descarta tudo que não está na lista branca (ver lib/ux-friction.ts).
 *
 * Falha aqui nunca deve incomodar o operador: o coletor ignora a resposta.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new NextResponse(null, { status: 401 });

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return new NextResponse(null, { status: 400 });
    }

    const sessionId = sanitizeSessionId((body as { sessionId?: unknown })?.sessionId);
    const rows = sanitizeBatch(body);
    if (!sessionId || rows.length === 0) return new NextResponse(null, { status: 204 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_id, role")
      .eq("id", user.id)
      .maybeSingle();
    // Família (responsável) não é operador do sistema: não é monitorada.
    if (!profile || profile.role === "responsavel") return new NextResponse(null, { status: 204 });

    const { error } = await createAdminClient()
      .from("ux_events")
      .insert(
        rows.map((r) => ({
          clinic_id: profile.clinic_id,
          profile_id: user.id,
          role: profile.role,
          session_id: sessionId,
          route: r.route,
          event_type: r.event_type,
          target: r.target,
          detail: r.detail,
          // Ordem real dos eventos (a rota "vai e volta" do relatório depende dela).
          created_at: new Date(Date.now() - r.ago_ms).toISOString(),
        })),
      );
    if (error) console.error("[UX Events] Falha ao gravar:", error.message);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[UX Events] Erro:", err instanceof Error ? err.message : err);
    return new NextResponse(null, { status: 204 });
  }
}
