import { NextResponse } from "next/server";
import { authenticateAgent, loadAgentJob } from "@/lib/portal-robot";

export const dynamic = "force-dynamic";

const IN_PROGRESS = new Set(["em_andamento", "aguardando_confirmacao", "confirmado"]);

/**
 * Andamento do pedido (passo do portal em que o robô está) e chegada ao resumo
 * ("aguardando_confirmacao", com o que o robô leu no portal). Sem campos, só
 * consulta: é assim que o agente espera a recepção confirmar ou cancelar na tela.
 * Responde sempre o status atual do pedido.
 */
export async function POST(req: Request) {
  const auth = await authenticateAgent(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { admin, agent } = auth;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const job = await loadAgentJob(admin, agent, body.job_id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (IN_PROGRESS.has(job.status)) {
    const step = Number(body.step);
    if (Number.isInteger(step) && step >= 0 && step <= 10) patch.step = step;
    if (typeof body.step_label === "string") patch.step_label = body.step_label.slice(0, 120);
  }
  if (body.status === "aguardando_confirmacao" && job.status === "em_andamento") {
    patch.status = "aguardando_confirmacao";
    if (body.portal_summary && typeof body.portal_summary === "object") patch.portal_summary = body.portal_summary;
  }

  if (Object.keys(patch).length > 0) {
    // O status só avança a partir do que estava: se a recepção cancelou no meio, o update não pega.
    const { data, error } = await admin
      .from("portal_robot_jobs")
      .update(patch)
      .eq("id", job.id)
      .eq("status", job.status)
      .select("status")
      .maybeSingle();
    if (error) {
      console.error("[portal-robot/progress]", error);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
    if (data) return NextResponse.json({ status: data.status });
    const { data: fresh } = await admin.from("portal_robot_jobs").select("status").eq("id", job.id).maybeSingle();
    return NextResponse.json({ status: fresh?.status ?? job.status });
  }
  return NextResponse.json({ status: job.status });
}
