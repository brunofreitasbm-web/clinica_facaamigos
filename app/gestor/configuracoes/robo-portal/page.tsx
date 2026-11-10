import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { createClient } from "@/lib/supabase/server";
import { isAgentOnline } from "@/lib/portal-robot-pure";
import { RoboPortalManager, type RobotAgentView } from "./robo-portal-manager";

export const dynamic = "force-dynamic";

type AgentRow = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  last_seen_at: string | null;
  last_version: string | null;
};

export default async function RoboPortalPage() {
  const supabase = await createClient();
  // RLS (portal_robot_agents_read) já limita à clínica de quem está logado.
  // Cast: a tabela ainda não está em lib/database.types.ts (ver lib/portal-robot.ts).
  const { data } = await (supabase as unknown as SupabaseClient)
    .from("portal_robot_agents")
    .select("id, name, active, created_at, last_seen_at, last_version")
    .order("created_at", { ascending: false });

  const now = new Date();
  const agents: RobotAgentView[] = ((data ?? []) as AgentRow[]).map((a) => ({
    id: a.id,
    name: a.name,
    active: a.active,
    createdAt: a.created_at,
    lastSeenAt: a.last_seen_at,
    version: a.last_version,
    online: a.active && isAgentOnline(a.last_seen_at, now),
  }));

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        axisLabel="Configurações"
        title="Robô do portal"
        description="Computadores autorizados a rodar o robô que preenche o portal do plano na etapa de Autorizações."
      />
      <PageContainer>
        <RoboPortalManager agents={agents} />
      </PageContainer>
    </div>
  );
}
