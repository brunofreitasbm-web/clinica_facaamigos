import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A tela pública faz poll aqui a cada ~20s para saber se a recepção já
 * confirmou a chegada, usando o `public_token` opaco gravado em cookie
 * httpOnly por app/api/checkin/route.ts — nunca o `id` da linha, que seria
 * sequencialmente correlacionável entre chegadas.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const publicToken = req.cookies.get("ck_pt")?.value;
  if (!publicToken) {
    return NextResponse.json({ error: "Sem chegada registrada." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("checkin_requests")
    .select("status, ticket_label")
    .eq("public_token", publicToken)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Chegada não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ status: data.status, ticketLabel: data.ticket_label });
}
