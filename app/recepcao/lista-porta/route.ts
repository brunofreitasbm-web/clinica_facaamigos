import { NextRequest, NextResponse } from "next/server";
import { getEvaluationDoorList } from "@/lib/evaluation-door-list";
import { renderDoorListHtml } from "@/lib/evaluation-door-list-html";
import { CLINIC_TIMEZONE } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Lista do dia da 1ª avaliação para o acrílico da porta (A4, P&B). Rota sem
 * layout do app: o prefixo /recepcao já exige sessão de recepção no proxy.
 * `?auto=1` = modo iframe escondido do components/door-list-auto-print.tsx.
 */
export async function GET(req: NextRequest) {
  try {
    const { date, rows } = await getEvaluationDoorList();
    const dateLabel = new Intl.DateTimeFormat("pt-BR", {
      timeZone: CLINIC_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${date}T12:00:00Z`));
    const html = renderDoorListHtml({ dateLabel, rows, auto: req.nextUrl.searchParams.get("auto") === "1" });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Door List Error]:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
