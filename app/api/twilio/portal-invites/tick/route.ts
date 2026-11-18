import { isValidCronSecret } from "@/lib/cron-auth";
import { NextRequest, NextResponse } from "next/server";
import { runPortalInviteTick } from "@/lib/portal-invite";

export const maxDuration = 60;

/**
 * Convite ao Portal da Família por WhatsApp (lib/portal-invite.ts). Chamado de 1 em 1 minuto pelo pg_cron de
 * supabase/migrations/20261118130000_portal_cupom_chat_convites.sql; cada chamada envia no máximo UMA mensagem e
 * só quando o intervalo aleatório venceu. `?dry=1` conta quem receberia (header x-cron-secret), sem enviar nada.
 */
export async function POST(req: NextRequest) {
  if (!isValidCronSecret(req.headers.get("x-cron-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    return NextResponse.json(await runPortalInviteTick({ dryRun: dry }));
  } catch (error) {
    console.error("[Portal Invite Error]:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
