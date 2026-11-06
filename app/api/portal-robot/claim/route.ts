import { NextResponse } from "next/server";
import { authenticateAgent, signedLaudoUrl, type PortalRobotJobRow } from "@/lib/portal-robot";

export const dynamic = "force-dynamic";

/**
 * O agente local (robô do portal do plano) pergunta se há pedido na fila. Serve
 * também de "sinal de vida": a tela de Autorizações mostra o robô ligado enquanto
 * o agente chama esta rota. A reserva é atômica (claim_portal_robot_job, skip
 * locked), então dois agentes nunca pegam o mesmo pedido. Ver docs/portal-robot.md.
 */
export async function POST(req: Request) {
  const auth = await authenticateAgent(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { admin, agent } = auth;

  const { data, error } = await admin.rpc("claim_portal_robot_job", { p_agent_id: agent.id });
  if (error) {
    console.error("[portal-robot/claim]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
  const job = (Array.isArray(data) ? data[0] : data) as PortalRobotJobRow | undefined;
  if (!job) return NextResponse.json({ job: null });

  const laudoUrl = job.payload?.laudo?.storage_path ? await signedLaudoUrl(admin, job.payload.laudo.storage_path) : null;
  return NextResponse.json({
    job: {
      id: job.id,
      portal: job.portal,
      mode: job.mode,
      payload: job.payload,
      laudo_url: laudoUrl,
    },
  });
}
