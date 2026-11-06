import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { canAgentFinish, type AgentOutcome } from "@/lib/portal-robot-pure";
import { authenticateAgent, loadAgentJob, markDraftGuideSentByRobot, saveScreenshot } from "@/lib/portal-robot";

export const dynamic = "force-dynamic";

const OUTCOMES: AgentOutcome[] = ["enviado", "simulado", "erro", "verificar"];

/**
 * Fim do pedido, mandado pelo agente (multipart, com o print da tela do portal):
 *  - enviado: clicou em Autorizar e leu o retorno → marca a etapa 2 do contato;
 *  - verificar: clicou em Autorizar mas não leu o retorno → nunca repetir sozinho;
 *  - simulado: modo simulação parou no resumo; erro: nada foi enviado.
 */
export async function POST(req: Request) {
  const auth = await authenticateAgent(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { admin, agent } = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }
  const job = await loadAgentJob(admin, agent, form.get("job_id"));
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const outcome = String(form.get("outcome") ?? "") as AgentOutcome;
  if (!OUTCOMES.includes(outcome)) return NextResponse.json({ error: "invalid_outcome" }, { status: 400 });
  if (!canAgentFinish(job.status, outcome, job.mode)) {
    return NextResponse.json({ error: "invalid_transition", status: job.status }, { status: 409 });
  }

  const text = (key: string, max: number) => {
    const v = form.get(key);
    return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  };
  const shot = form.get("screenshot");
  const screenshotPath = await saveScreenshot(admin, job, shot instanceof File ? shot : null);

  // Pedido cancelado pela recepção enquanto o robô preenchia: continua "cancelado", só guarda o print.
  const finalStatus = job.status === "cancelado" ? "cancelado" : outcome;
  const { data: updated, error } = await admin
    .from("portal_robot_jobs")
    .update({
      status: finalStatus,
      result: { portal_status: text("portal_status", 200), guide_number: text("guide_number", 60), message: text("message", 1000) },
      error: outcome === "erro" || outcome === "verificar" ? text("message", 1000) : null,
      ...(screenshotPath ? { screenshot_path: screenshotPath } : {}),
      finished_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", job.status)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    if (error) console.error("[portal-robot/result]", error);
    return NextResponse.json({ error: "conflict" }, { status: 409 });
  }

  if (finalStatus === "enviado") await markDraftGuideSentByRobot(admin, job);

  revalidatePath("/recepcao/a-autorizar");
  revalidatePath("/recepcao/pacientes/pendencias");
  return NextResponse.json({ status: finalStatus });
}
