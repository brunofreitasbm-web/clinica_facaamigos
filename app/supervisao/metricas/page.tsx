import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { HelpHint } from "@/components/ui/help-hint";
import { BonusProgressCard } from "@/components/bonus-progress-card";
import { createClient } from "@/lib/supabase/server";
import { DEV_CLINIC_ID } from "@/lib/constants";
import { getMyBonusProgress } from "@/lib/bonus-progress";

export const dynamic = "force-dynamic";

/**
 * Auto-acompanhamento de bonificação da Coordenação clínica — mesmo motor de
 * app/terapeuta/metricas (lib/bonus-progress.ts), amarrado ao cargo
 * "supervisor".
 */
export default async function SupervisaoMetricasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "supervisor" && profile.role !== "gestor")) {
    redirect("/");
  }

  const progress = await getMyBonusProgress(supabase, DEV_CLINIC_ID, "supervisor");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <PageContainer className="max-w-[720px]">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
            Minha bonificação
            <HelpHint text="Progresso do mês corrente nas métricas de bonificação definidas pelo gestor para a Coordenação clínica. Atualiza a cada carregamento; o valor oficial é fechado no dia 1." />
          </h1>
        </div>
        <BonusProgressCard progress={progress} />
      </PageContainer>
    </div>
  );
}
